
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from uuid import UUID
import shutil
import os
from datetime import datetime

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.device import Device
from app.models.rule import FirewallRule
from app.services.traffic_analyzer import TrafficAnalyzerService

router = APIRouter(
    prefix="/api/devices/{device_id}/tuner",
    tags=["Traffic Tuner"]
)

# In-Memory Cache for Demo purposes (Store parsed logs per device)
# In prod, this should be Redis or DB
DEVICE_LOG_CACHE = {} 

@router.post("/upload")
async def upload_traffic_logs(
    device_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload traffic logs (CSV/TXT) for analysis.
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    content = await file.read()
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = content.decode('latin-1')

    # Parse Logs
    logs = TrafficAnalyzerService.parse_logs(text_content)
    
    if not logs:
        raise HTTPException(status_code=400, detail="No valid log entries found. Check format.")

    # Cache logs for session
    # We key by device_id. A real system would persist this.
    DEVICE_LOG_CACHE[str(device_id)] = logs

    return {
        "message": f"Successfully processed {len(logs)} log entries.",
        "count": len(logs)
    }

@router.get("/candidates")
async def get_tuning_candidates(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get rules ranked by permissiveness score.
    """
    rules = db.query(FirewallRule).filter(FirewallRule.device_id == device_id).all()
    
    candidates = []
    for rule in rules:
        analysis = TrafficAnalyzerService.calculate_permissiveness_score(rule)
        if analysis["score"] > 0:
            candidates.append({
                "rule": {
                    "id": rule.id,
                    "name": rule.name,
                    "source": rule.source,
                    "destination": rule.destination,
                    "service": rule.service,
                    "action": rule.action,
                    "hits": rule.hits
                },
                "score": analysis["score"],
                "level": analysis["level"],
                "reasons": analysis["reasons"]
            })
            
    # Sort by Score Descending
    candidates.sort(key=lambda x: x["score"], reverse=True)
    
    return candidates

@router.get("/proposals/{rule_id}")
async def get_tuner_proposal(
    device_id: UUID,
    rule_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate optimizations for a specific rule using uploaded logs.
    """
    rule = db.query(FirewallRule).filter(FirewallRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    logs = DEVICE_LOG_CACHE.get(str(device_id), [])
    
    # 1. Filter Logs applicable to this rule
    # In a real system, logs would have rule_id/hash. 
    # For now, we do basic 5-tuple matching if rule_id missing, 
    # OR we assume the user uploaded logs *specifically* for this rule context 
    # OR we match roughly based on rule definition (e.g. if rule says ANY, all logs match? No.)
    
    # Matching Logic Strategy for Demo:
    # If the log has 'rule_hash' and it matches rule.rule_hash -> Match.
    # Else, if the rule is "Permit Any Any", ALL logs match (that are permitted).
    
    matched_logs = []
    for log in logs:
        # Check explicit link
        if log.get("rule_hash") and rule.rule_hash:
            if log["rule_hash"] in rule.rule_hash: # simple string check
                matched_logs.append(log)
                continue
                
        # Heuristic Matching (If rule is Any/Any)
        # Assuming these logs belong to this device...
        # If rule source is ANY or covers log src...
        # This is complex to do perfectly in Python without a library like `netaddr` or `ipaddress` for every row.
        # ALLOW ANY logic:
        if rule.source.lower() == "any" and rule.destination.lower() == "any":
            matched_logs.append(log)
    
    # If no logs match, we can't optimize (or we optimize to "Delete"?)
    # For safety, we return "No Data".
    
    # 2. Run Aggregation
    proposals = TrafficAnalyzerService.aggregate_flows(matched_logs)
    
    return {
        "rule_id": rule.id,
        "matched_log_count": len(matched_logs),
        "proposals": proposals,
        "original_rule": {
            "source": rule.source,
            "destination": rule.destination,
            "service": rule.service
        }
    }
