from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import hashlib
from app.models.rule import FirewallRule
from app.models.device import Device
from app.schemas.merger import MergeGroup, RuleBase

class MergerService:
    @staticmethod
    def identify_candidates(db: Session, device_id: UUID = None) -> List[MergeGroup]:
        query = db.query(FirewallRule) # Removed is_unused filter
        
        if device_id:
            query = query.filter(FirewallRule.device_id == device_id, FirewallRule.parent_id == None)
            
        rules = query.all()
        
        from app.services.shadow_detector import ShadowDetectorService

        # Group by ACL Name and Device first to reduce search space
        acl_groups = {}
        for rule in rules:
            k = (rule.device_id, rule.name)
            if k not in acl_groups:
                acl_groups[k] = []
            acl_groups[k].append(rule)
            
        merge_groups = []
        
        for (dev_id, acl_name), acl_rules in acl_groups.items():
            # fetch device name
            device = db.query(Device).filter(Device.id == dev_id).first()
            dev_name = device.name if device else "Unknown Device"

            # Check for redundancy: Is rule B covered by rule A?
            # We want to group by the "Master" (covering) rule.
            # Dict: master_rule_id -> [list of covered rules]
            matches = {}
            
            # Use index to ensure we only check against PRIOR rules (precedence)
            for i in range(len(acl_rules)):
                current = acl_rules[i]
                
                # Check against all PREVIOUS rules for coverage
                is_covered = False
                for j in range(i):
                    prior = acl_rules[j]
                    
                    # Must be same action to be mergeable/redundant
                    if prior.action != current.action:
                        continue
                        
                    # Check coverage
                    # Using ShadowDetector logic: is current SUBSET of prior?
                    src_sub = ShadowDetectorService._is_network_subset(current.source, prior.source)
                    dst_sub = ShadowDetectorService._is_network_subset(current.destination, prior.destination)
                    svc_sub = ShadowDetectorService._is_network_subset(current.service, prior.service)
                    
                    if src_sub and dst_sub and svc_sub:
                        # FOUND REDUNDANCY
                        # 'prior' covers 'current'
                        if prior.id not in matches:
                            matches[prior.id] = {"master": prior, "candidates": []}
                        
                        matches[prior.id]["candidates"].append(current)
                        is_covered = True
                        break # Found a cover, stop looking
            
            # Convert matches to MergeGroups
            for m_id, data in matches.items():
                master = data["master"]
                candidates = data["candidates"]
                
                all_rules = [master] + candidates
                
                # Generate stable ID
                group_id_str = f"{master.id}-{len(candidates)}"
                group_hash = hashlib.md5(group_id_str.encode()).hexdigest()
                
                merge_groups.append(MergeGroup(
                    id=group_hash,
                    device_id=dev_id,
                    device_name=dev_name,
                    common_attributes={
                        "source": master.source, # The broader scope
                        "destination": master.destination,
                        "service": master.service,
                        "action": master.action
                    },
                    rules=[RuleBase.model_validate(r) for r in all_rules],
                    potential_savings=len(candidates),
                    complexity="low"
                ))
                
        return merge_groups

    @staticmethod
    def execute_merge(db: Session, group_id: str, candidate_groups: List[MergeGroup], user_email: str):
        from app.models.change import Change, ChangeStatus
        
        # Find the group in the recently fetched list (or refetch if needed, but passing for now)
        # For this simple implementation, we select the one with MOST HITS as "MASTER" and delete others.
        
        group = next((g for g in candidate_groups if g.id == group_id), None)
        if not group:
            raise ValueError("Merge group not found or expired")
            
        rules_to_merge = group.rules
        if len(rules_to_merge) < 2:
            return {"success": False, "message": "Group has insufficient rules"}
            
        # Keep the one with the most hits
        sorted_rules = sorted(rules_to_merge, key=lambda r: r.hits, reverse=True)
        master_rule_info = sorted_rules[0]
        
        # Rules affected snapshot (Master + Redundant)
        rules_affected_snapshot = []
        
        # Add Master Rule (to keep)
        rules_affected_snapshot.append({
            "id": str(master_rule_info.id),
            "role": "master",
            "name": master_rule_info.name,
            "hits": master_rule_info.hits # Current hits
        })
        
        redundant_count = 0
        for redundant_info in sorted_rules[1:]:
             rules_affected_snapshot.append({
                "id": str(redundant_info.id),
                "role": "redundant",
                "name": redundant_info.name,
                "hits": redundant_info.hits, # Hits to merge
                "action": "delete"
            })
             redundant_count += 1
                
        # Create Change Record (Pending)
        change_record = Change(
            device_id=group.device_id,
            user_email=user_email,
            type="merge",
            description=f"Request to merge {redundant_count} redundant rules into '{master_rule_info.name}'",
            rules_affected=rules_affected_snapshot,
            status=ChangeStatus.pending, # Request Mode
            rollback_available=False
        )
        db.add(change_record)
        db.commit()
        
        return {
            "success": True,
            "merged_count": 0, # Pending
            "message": f"Change request created for merging {redundant_count} rules. Pending approval."
        }
