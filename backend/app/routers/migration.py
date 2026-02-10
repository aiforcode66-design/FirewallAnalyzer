from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any
from pydantic import BaseModel
import json

from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.migration import PolicyMigrationService

router = APIRouter(
    prefix="/api/migration",
    tags=["migration"],
    responses={404: {"description": "Not found"}},
)

class ContextData(BaseModel):
    name: str
    objects: List[Dict[str, Any]] # {name, value, type}
    rules: List[Dict[str, Any]]   # {name, source, destination, service, action}

class MigrationAnalyzeRequest(BaseModel):
    contexts: List[ContextData]

class MigrationExecuteRequest(BaseModel):
    contexts: List[ContextData]
    strategy: str = "auto_rename_context"
    target_device_name: str # The name for the new unified device

@router.post("/analyze")
async def analyze_conflicts(request: MigrationAnalyzeRequest):
    """
    Analyze uploaded contexts for object conflicts.
    Payload is a JSON structure of multiple contexts.
    """
    contexts_dicts = [ctx.model_dump() for ctx in request.contexts]
    result = PolicyMigrationService.analyze_conflicts(contexts_dicts)
    return result

@router.post("/execute")
async def execute_migration(
    request: MigrationExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate unified policy and SAVE as a new Device.
    """
    contexts_dicts = [ctx.model_dump() for ctx in request.contexts]
    
    # 1. Generate Logic
    result = PolicyMigrationService.generate_unified_policy(contexts_dicts, request.strategy)
    
    # 2. Create Unified Device in DB
    
    # 2. Create Unified Device in DB
    from app.models.device import Device
    from app.models.rule import FirewallRule
    from app.models.vendor import Vendor
    
    vendor = db.query(Vendor).first()
    
    from datetime import datetime
    
    new_device = Device(
        name=request.target_device_name,
        ip_address="127.0.0.1",
        vendor_id=vendor.id if vendor else None,
        model="Unified Policy",
        status="active",
        description="Automatically created by Policy Migration Wizard",
        config_date=datetime.utcnow()
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    # 3. Save Unified Rules (with children)
    rules_to_create = []
    for seq_idx, r in enumerate(result["rules"]):
        parent_rule = FirewallRule(
            device_id=new_device.id,
            name=str(r.get("name", "Unknown"))[:255],
            source=str(r.get("source", "any"))[:500],
            destination=str(r.get("destination", "any"))[:500],
            service=str(r.get("service", "any"))[:255],
            action=str(r.get("action", "deny"))[:50],
            hits=int(r.get("hits", 0)),
            is_unused=(int(r.get("hits", 0)) == 0),
            sequence=seq_idx + 1,  # Preserve rule ordering
        )
        
        # Add children (sub-ACEs)
        for child_data in r.get("children", []):
            child_rule = FirewallRule(
                device_id=new_device.id,
                name=str(child_data.get("name", parent_rule.name))[:255],
                source=str(child_data.get("source", "any"))[:500],
                destination=str(child_data.get("destination", "any"))[:500],
                service=str(child_data.get("service", "any"))[:255],
                action=str(child_data.get("action", "deny"))[:50],
                hits=int(child_data.get("hits", 0)),
                is_unused=(int(child_data.get("hits", 0)) == 0),
            )
            parent_rule.children.append(child_rule)
        
        rules_to_create.append(parent_rule)
    
    if rules_to_create:
        db.add_all(rules_to_create)
        new_device.rules_count = len(rules_to_create)
        db.commit()


    # 4. Save Unified Objects
    # We need to format the objects for ObjectService.ingest_objects
    # result["objects"] contains list of {name, value, type}
    
    extracted_data = {"objects": [], "groups": []}
    
    for obj in result["objects"]:
        if isinstance(obj["value"], list):
             # It is a group
             extracted_data["groups"].append({
                 "name": obj["name"],
                 "type": obj["type"],
                 "members": obj["value"], # List of raw strings
                 "description": "" 
             })
        else:
             # It is an object
             extracted_data["objects"].append({
                 "name": obj["name"],
                 "type": obj["type"],
                 "value": str(obj["value"]), # Ensure string
                 "description": ""
             })
             
    from app.services.object_service import ObjectService
    try:
        ObjectService.ingest_objects(db, new_device.id, extracted_data)
    except Exception as e:
        print(f"Warning: Failed to ingest objects for unified device: {e}")
        # non-blocking for the main migration response
        
    return {
        "unified_device_id": new_device.id,
        "message": f"Successfully created unified device '{new_device.name}' with {len(rules_to_create)} rules and {len(extracted_data['objects'])+len(extracted_data['groups'])} objects.",
        "policy": result
    }
