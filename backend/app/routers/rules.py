from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.rule import FirewallRule
from app.services.merger import MergerService
from app.schemas.merger import MergeGroup, MergeResult, MergeRequest
from app.schemas.rule import FirewallRuleResponse

router = APIRouter(
    prefix="/api/rules",
    tags=["rules"],
    responses={404: {"description": "Not found"}},
)

@router.get("", response_model=List[FirewallRuleResponse])
async def get_rules(
    device_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all firewall rules with optional filtering.
    """
    query = db.query(FirewallRule)
    
    if device_id:
        query = query.filter(FirewallRule.device_id == device_id)
        
    # Only show top-level rules in default view to prevent duplication
    # Child rules are already included in the 'children' relationship
    if not (search or action):
        query = query.filter(FirewallRule.parent_id.is_(None))

    if action:
        query = query.filter(FirewallRule.action == action)
        
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (FirewallRule.name.ilike(search_fmt)) |
            (FirewallRule.source.ilike(search_fmt)) |
            (FirewallRule.destination.ilike(search_fmt)) |
            (FirewallRule.service.ilike(search_fmt))
        )
        
    from sqlalchemy import func
    rules = query.order_by(
        func.coalesce(FirewallRule.sequence, 999999).asc()
    ).offset(skip).limit(limit).all()
    return rules

@router.get("/merge-candidates", response_model=List[MergeGroup])
async def get_merge_candidates(
    device_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify potential rule merge candidates.
    Currently finds exact duplicate rules (same source, dest, service, action).
    """
    candidates = MergerService.identify_candidates(db, device_id)
    return candidates

@router.post("/merge", response_model=MergeResult)
async def execute_merge(
    request: MergeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Execute merge for selected groups.
    """
    requests_created = 0
    errors = []
    
    # Verify current candidates
    current_candidates = MergerService.identify_candidates(db)
    
    for group_id in request.group_ids:
        try:
            result = MergerService.execute_merge(db, group_id, current_candidates, current_user.email)
            if result.get("success"):
                requests_created += 1
            else:
                errors.append(f"Group {group_id}: {result.get('message')}")
        except ValueError as e:
            errors.append(f"Group {group_id}: {str(e)}")
            
    if errors:
        return MergeResult(
            success=False if requests_created == 0 else True,
            merged_count=0,
            message=f"Created {requests_created} change requests. Errors: {'; '.join(errors)}"
        )
        
    return MergeResult(
        success=True,
        merged_count=0,
        message=f"Successfully created {requests_created} change requests for merge approval."
    )

from app.schemas.rule import FirewallRuleResponse, UnusedRulesResponse

@router.get("/unused", response_model=UnusedRulesResponse) 
async def get_unused_rules(
    device_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 50,
    retention_days: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all unused rules (paginated + retention policy)."""
    from app.services.cleanup import CleanupService
    # Returns {"rules": [...], "total": count}
    result = CleanupService.get_unused_rules(db, device_id, skip, limit, retention_days)
    return {"items": result["rules"], "total": result["total"]}

class CleanupRequest(BaseModel):
    rule_ids: List[UUID]

@router.post("/cleanup")
async def cleanup_rules(
    request: CleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete unused rules."""
    from app.services.cleanup import CleanupService
    result = CleanupService.cleanup_rules(db, request.rule_ids, current_user.email)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    return result


@router.get("/usage-status/{device_id}")
async def get_usage_status(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if device has any usage data (last_hit) in its rules.
    Returns True if at least one rule has last_hit not null.
    """
    # Check if ANY rule for this device has a non-null last_hit
    has_last_hit = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.last_hit.isnot(None)
    ).first() is not None
    
    # Also count total rules to provide context
    total_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id
    ).count()
    
    return {
        "device_id": str(device_id),
        "has_last_hit_data": has_last_hit,
        "total_rules": total_rules
    }
