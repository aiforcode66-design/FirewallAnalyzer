from sqlalchemy.orm import Session
from uuid import UUID
from app.models.object import FirewallObject, ObjectGroup
from app.models.rule import FirewallRule
import uuid

class ObjectService:
    @staticmethod
    def ingest_objects(db: Session, device_id: UUID, extracted_data: dict):
        """
        Ingest parsed objects and groups into the database.
        extracted_data = {"objects": [...], "groups": [...]}
        """
        # 1. Clear existing objects and groups (Cascade should handle associations)
        db.query(ObjectGroup).filter(ObjectGroup.device_id == device_id).delete()
        db.query(FirewallObject).filter(FirewallObject.device_id == device_id).delete()
        db.flush()

        # Maps for resolution
        obj_name_map = {}
        group_name_map = {}

        # 2. Insert Objects
        new_objects = []
        for obj_data in extracted_data["objects"]:
            new_obj = FirewallObject(
                device_id=device_id,
                name=obj_data["name"],
                type=obj_data["type"],
                value=obj_data.get("value"),
                description=obj_data.get("description"),
                is_unused=True # Default
            )
            new_objects.append(new_obj)
        
        db.add_all(new_objects)
        db.flush() # flush to get IDs
        
        for o in new_objects:
            obj_name_map[o.name] = o

        # 3. Insert Groups (First Pass - No Members)
        new_groups = []
        for grp_data in extracted_data["groups"]:
            new_grp = ObjectGroup(
                device_id=device_id,
                name=grp_data["name"],
                type=grp_data.get("type", "group"),
                description=grp_data.get("description"),
                is_unused=True
            )
            new_groups.append(new_grp)
            
        db.add_all(new_groups)
        db.flush()
        
        for g in new_groups:
            group_name_map[g.name] = g

        # 4. Resolve Group Members (Second Pass)
        for grp_data in extracted_data["groups"]:
            group_db = group_name_map.get(grp_data["name"])
            if not group_db: continue
            
            for member_line in grp_data["members"]:
                # Parse member line "network-object host 1.1.1.1" or "object-group NAME"
                parts = member_line.strip().split()
                if not parts: continue
                
                keyword = parts[0].lower()
                
                # Check for "object-group NAME" or "group-object NAME"
                if keyword in ["object-group", "group-object"]:
                    if len(parts) >= 2:
                        target_name = parts[1]
                        sub_grp = group_name_map.get(target_name)
                        if sub_grp and sub_grp not in group_db.sub_groups:
                            group_db.sub_groups.append(sub_grp)
                            
                # Check for "network-object object NAME" or "service-object object NAME"
                elif keyword in ["network-object", "service-object", "port-object"]:
                    if len(parts) >= 3 and parts[1].lower() == "object":
                        target_name = parts[2]
                        target_obj = obj_name_map.get(target_name)
                        if target_obj and target_obj not in group_db.member_objects:
                            group_db.member_objects.append(target_obj)
                    elif len(parts) >= 3 and parts[1].lower() == "host":
                        # Inline host member (not a named object)
                        # network-object host 1.1.1.1
                        # For now, we only track NAMED objects usage. 
                        # Inline values don't map to FirewallObject unless we create ad-hoc ones.
                        # Skipping inline for now as they aren't "Unused Objects" (they are just values)
                        pass
        
        db.commit()

    @staticmethod
    def analyze_usage(db: Session, device_id: UUID):
        """
        Analyze rules to mark objects and groups as used.
        """
        # Reset all to unused (already default on insert, but good for re-runs)
        # db.query(FirewallObject).filter(FirewallObject.device_id == device_id).update({"is_unused": True})
        # db.query(ObjectGroup).filter(ObjectGroup.device_id == device_id).update({"is_unused": True})
        
        # 1. Collect all rule source/dest/service strings
        rules = db.query(FirewallRule).filter(FirewallRule.device_id == device_id).all()
        
        used_names = set()
        for rule in rules:
            # Simple exact match or "object-group X" extraction
            # Real parsing needs to handle "object X", "object-group Y"
            # And also direct names potentially if CLI allows.
            
            # Helper to extract names from rule fields
            for field in [rule.source, rule.destination, rule.service]:
                if not field: continue
                # Handle "object-group NAME"
                if "object-group" in field:
                    name = field.replace("object-group", "").strip()
                    # Remove operators like eq, lt if attached? usually rule.service is "tcp / eq 80" or "object-group DMZ_PORTS"
                    used_names.add(name)
                elif "object" in field:
                     name = field.replace("object", "").strip()
                     used_names.add(name)
                else:
                    # Might be just the name directly or an IP
                    # How to differentiate "1.1.1.1" from "Web_Server"?
                    # We can add all tokens and see if they match an object name.
                    tokens = field.split()
                    for t in tokens:
                        used_names.add(t.strip())

        # 2. Mark Used Objects/Groups
        # Recursive marking
        processed_groups = set()
        
        def mark_group_used(group_name):
            if group_name in processed_groups: return
            processed_groups.add(group_name)
            
            grp = db.query(ObjectGroup).filter(ObjectGroup.device_id == device_id, ObjectGroup.name == group_name).first()
            if grp:
                grp.is_unused = False
                # recursively mark sub-groups and objects
                for sub in grp.sub_groups:
                    sub.is_unused = False
                    mark_group_used(sub.name)
                for obj in grp.member_objects:
                    obj.is_unused = False
        
        def mark_object_used(obj_name):
            obj = db.query(FirewallObject).filter(FirewallObject.device_id == device_id, FirewallObject.name == obj_name).first()
            if obj:
                obj.is_unused = False

        # Apply to initial set
        for name in used_names:
            mark_group_used(name)
            mark_object_used(name)
            
        db.commit()
