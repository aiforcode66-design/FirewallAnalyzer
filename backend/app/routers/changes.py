from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.change import Change
from app.models.device import Device
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.change import ChangeCreate, ChangeUpdate, ChangeResponse
from app.models.rule import FirewallRule
from app.models.object import FirewallObject, ObjectGroup

router = APIRouter(prefix="/api/changes", tags=["Changes"])

@router.get("", response_model=List[ChangeResponse])
async def get_changes(
    device_id: Optional[UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all changes with optional filtering."""
    query = db.query(Change)
    
    if device_id:
        query = query.filter(Change.device_id == device_id)
    if status and status != 'all':
        query = query.filter(Change.status == status)
        
    changes = query.order_by(Change.created_at.desc()).offset(skip).limit(limit).all()
    return changes

@router.post("", response_model=ChangeResponse, status_code=status.HTTP_201_CREATED)
async def create_change(
    change_data: ChangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a new change request."""
    # Verify device exists
    device = db.query(Device).filter(Device.id == change_data.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    new_change = Change(
        device_id=change_data.device_id,
        user_email=current_user.email,
        type=change_data.type,
        description=change_data.description,
        rules_affected=change_data.rules_affected or [],
        status="pending",
        rollback_available=False
    )
    
    db.add(new_change)
    db.commit()
    db.refresh(new_change)
    return new_change

@router.put("/{change_id}", response_model=ChangeResponse)
async def update_change(
    change_id: UUID,
    change_data: ChangeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a change request (e.g. approve/reject)."""
    change = db.query(Change).filter(Change.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Change request not found")
        
    update_data = change_data.model_dump(exclude_unset=True)
    
    # Check if status is being updated to 'approved'
    new_status = update_data.get('status')
    if new_status == 'approved' and change.status != 'approved':
        # EXECUTE CHANGE ON APPROVAL
        
        # 1. Cleanup Rules
        if change.type == 'cleanup':
            # Extract IDs from rules_affected snapshot
            if change.rules_affected:
                rule_ids = [item.get('id') for item in change.rules_affected if item.get('id')]
                if rule_ids:
                    # Execute deletion
                    db.query(FirewallRule).filter(FirewallRule.id.in_(rule_ids)).delete(synchronize_session=False)
        
        # 2. Cleanup Objects
        elif change.type == 'cleanup-objects':
            if change.rules_affected:
                obj_ids = [item.get('id') for item in change.rules_affected if item.get('id')]
                if obj_ids:
                    # Execute deletion for Objects and Groups
                    db.query(FirewallObject).filter(FirewallObject.id.in_(obj_ids)).delete(synchronize_session=False)
                    db.query(ObjectGroup).filter(ObjectGroup.id.in_(obj_ids)).delete(synchronize_session=False)

        # 3. Merge Rules
        elif change.type == 'merge':
            if change.rules_affected:
                master_info = next((r for r in change.rules_affected if r.get('role') == 'master'), None)
                redundant_infos = [r for r in change.rules_affected if r.get('role') == 'redundant']
                
                if master_info and redundant_infos:
                    master_id = master_info.get('id')
                    master_rule = db.query(FirewallRule).filter(FirewallRule.id == master_id).first()
                    
                    if master_rule:
                        for r_info in redundant_infos:
                            r_id = r_info.get('id')
                            redundant_rule = db.query(FirewallRule).filter(FirewallRule.id == r_id).first()
                            
                            
                            if redundant_rule:
                                # Transfer hits (from DB to be accurate)
                                master_rule.hits += redundant_rule.hits
                                db.delete(redundant_rule)
                        
                        db.add(master_rule) # Update master rule hits
        
        # 4. Delete Rule (e.g. Shadowed Rules)
        elif change.type == 'delete':
            if change.rules_affected:
                rule_ids = [item.get('id') for item in change.rules_affected if item.get('id')]
                if rule_ids:
                    # Execute deletion
                    db.query(FirewallRule).filter(FirewallRule.id.in_(rule_ids)).delete(synchronize_session=False)
        
        # Override status to 'implemented' for automated tasks because they are executed immediately
        if change.type in ['cleanup', 'cleanup-objects', 'merge', 'delete']:
            update_data['status'] = 'implemented'

    for field, value in update_data.items():
        setattr(change, field, value)
        
    db.commit()
    db.refresh(change)
    return change

@router.delete("/{change_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_change(
    change_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a change request."""
    change = db.query(Change).filter(Change.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Change request not found")
        
    db.delete(change)
    db.commit()
    return None
