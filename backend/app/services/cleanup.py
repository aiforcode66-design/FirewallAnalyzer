from sqlalchemy.orm import Session
from typing import List, Dict
from uuid import UUID
from datetime import datetime
from app.models.rule import FirewallRule
from app.models.change import Change, ChangeStatus
import json

class CleanupService:
    @staticmethod
    def get_unused_rules(db: Session, device_id: UUID = None, skip: int = 0, limit: int = 50, retention_days: int = None) -> Dict:
        from sqlalchemy import or_
        from datetime import datetime, timedelta
        
        # Base query
        query = db.query(FirewallRule)
        
        # Logic: unused if is_unused=True OR (retention_days set AND last_hit < threshold)
        if retention_days is not None and retention_days > 0:
            cutoff = datetime.utcnow() - timedelta(days=retention_days)
            # (matches zero hits) OR (matches old hits)
            query = query.filter(
                or_(
                    FirewallRule.is_unused == True,
                    FirewallRule.last_hit < cutoff
                )
            )
        else:
            # Default behavior (Strict Zero Hits)
            query = query.filter(FirewallRule.is_unused == True)
            
        if device_id:
            query = query.filter(FirewallRule.device_id == device_id)
            
        total = query.count()
        rules = query.offset(skip).limit(limit).all()
        
        return {"rules": rules, "total": total}

    @staticmethod
    def cleanup_rules(db: Session, rule_ids: List[UUID], user_email: str) -> Dict:
        """
        Soft delete or archive rules. 
        For now, we will create a 'Change' record for valid audit trail, then delete.
        In a real system, we might move to an 'archived_rules' table.
        """
        
        # 1. Fetch rules to be deleted
        rules = db.query(FirewallRule).filter(FirewallRule.id.in_(rule_ids)).all()
        if not rules:
            return {"success": False, "message": "No rules found with provided IDs"}
            
        device_id = rules[0].device_id # Assumes all rules from same device for strict change logging, but simplified here
        
        # 2. Create Change Record (Audit Trail)
        deleted_rules_snapshot = [
            {
                "id": str(r.id), # Store ID for later execution
                "name": r.name, 
                "source": r.source, 
                "destination": r.destination, 
                "service": r.service, 
                "action": r.action
            } for r in rules
        ]
        
        change_record = Change(
            device_id=device_id,
            user_email=user_email,
            type="cleanup",
            description=f"Request to cleanup {len(rules)} unused rules",
            rules_affected=deleted_rules_snapshot,
            status=ChangeStatus.pending, # Changed to pending for approval workflow
            rollback_available=True 
        )
        db.add(change_record)
        
        # 3. DO NOT Delete Rules Yet (Wait for Approval)
        # for rule in rules:
        #     db.delete(rule)
            
        db.commit()
        
        return {
            "success": True, 
            "deleted_count": 0, # None deleted yet
            "message": f"Change request created for {len(rules)} rules. Pending approval."
        }

    @staticmethod
    def cleanup_objects(db: Session, object_ids: List[UUID], user_email: str) -> Dict:
        """
        Delete unused objects (FirewallObject) and groups (ObjectGroup).
        Creates a Change record for audit trail.
        """
        from app.models.object import FirewallObject, ObjectGroup
        
        # 1. Fetch objects and groups to be deleted
        # We need to check both tables as IDs could be from either
        objs = db.query(FirewallObject).filter(FirewallObject.id.in_(object_ids)).all()
        grps = db.query(ObjectGroup).filter(ObjectGroup.id.in_(object_ids)).all()
        
        all_items = objs + grps
        
        if not all_items:
            return {"success": False, "message": "No objects found with provided IDs"}
            
        device_id = all_items[0].device_id
        
        # 2. Create Change Record
        # 2. Create Change Record
        deleted_items_snapshot = [
            {
                "id": str(item.id), # Store ID for execution
                "name": item.name,
                "type": item.type,
                "value": getattr(item, 'value', 'Group'), # Groups don't have value, Objects do
            } for item in all_items
        ]
        
        change_record = Change(
            device_id=device_id,
            user_email=user_email,
            type="cleanup-objects",
            description=f"Request to cleanup {len(all_items)} unused objects",
            rules_affected=deleted_items_snapshot, 
            status=ChangeStatus.pending, # Pending Approval
            rollback_available=False
        )
        db.add(change_record)
        
        # 3. DO NOT Delete Items Yet
        # for item in all_items:
        #     db.delete(item)
            
        db.commit()
        
        return {
            "success": True,
            "deleted_count": 0,
            "message": f"Change request created for {len(all_items)} objects. Pending approval."
        }
