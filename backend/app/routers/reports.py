from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Dict, Any, List
from uuid import UUID

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.device import Device
from app.models.rule import FirewallRule

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/executive/{device_id}")
async def get_executive_summary(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get executive summary stats for charts."""
    
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # 1. Rule Composition (parent rules only)
    total_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None
    ).count()
    
    action_stats = db.query(
        FirewallRule.action, 
        func.count(FirewallRule.id)
    ).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None
    ).group_by(FirewallRule.action).all()
    
    composition = {action: count for action, count in action_stats}
    
    # 2. Optimization Opportunity
    unused_count = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.is_unused == True,
        FirewallRule.parent_id == None
    ).count()
    
    active_count = total_rules - unused_count
    
    # 3. Security Risk Distribution
    # Assuming risk_level is populated (if not, we'll default to low/unknown)
    risk_stats = db.query(
        FirewallRule.risk_level,
        func.count(FirewallRule.id)
    ).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None
    ).group_by(FirewallRule.risk_level).all()
    
    risk_dist = {r: c for r, c in risk_stats if r}
    
    # Fill gaps
    risk_summary = {
        "critical": risk_dist.get("critical", 0),
        "high": risk_dist.get("high", 0),
        "medium": risk_dist.get("medium", 0),
        "low": risk_dist.get("low", 0) + risk_dist.get(None, 0) # Treat none as low/unassessed
    }

    return {
        "device_name": device.name,
        "total_rules": total_rules,
        "composition": composition,
        "optimization": {
            "unused": unused_count,
            "active": active_count,
            "pct_unused": round((unused_count / total_rules * 100), 1) if total_rules > 0 else 0
        },
        "security_risk": risk_summary
    }

@router.get("/compliance/{device_id}")
async def get_compliance_report(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of compliance issues."""
    
    issues = []
    
    # Check 1: Any-Any Rules (Permissive)
    any_any_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.action == 'allow',
        FirewallRule.source.ilike('%any%'),
        FirewallRule.destination.ilike('%any%'),
        FirewallRule.is_unused == False, # Only care about active ones
        FirewallRule.parent_id == None
    ).all()
    
    for r in any_any_rules:
        issues.append({
            "severity": "critical",
            "check": "Permissive Any-Any Rule",
            "description": f"Rule '{r.name}' allows Any to Any traffic.",
            "rule_id": str(r.id),
            "rule_name": r.name
        })

    # Check 2: Unused Rules > 90 Days (Stale)
    # This requires 'days_unused' logic from cleanup service or calculation
    # For now, simply check 'is_unused'
    unused_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.is_unused == True,
        FirewallRule.parent_id == None
    ).limit(50).all() # Cap for performance
    
    count_unused = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.is_unused == True,
        FirewallRule.parent_id == None
    ).count()

    if count_unused > 0:
        issues.append({
            "severity": "medium",
            "check": "Unused Rules",
            "description": f"Found {count_unused} rules that have been unused. These violate least-privilege principles.",
            "rule_id": "MULTIPLE",
            "rule_name": f"{count_unused} Rules"
        })

    # Check 3: Telnet Enabled (Service check)
    bad_services = ["telnet", "ftp", "http"]
    for svc in bad_services:
        risky_rules = db.query(FirewallRule).filter(
            FirewallRule.device_id == device_id,
            FirewallRule.service.ilike(f"%{svc}%"),
            FirewallRule.action == 'allow',
            FirewallRule.parent_id == None
        ).all()
        
        for r in risky_rules:
            issues.append({
                "severity": "high",
                "check": f"Insecure Protocol ({svc.upper()})",
                "description": f"Rule '{r.name}' allows insecure protocol {svc}.",
                "rule_id": str(r.id),
                "rule_name": r.name
            })
            
    return sorted(issues, key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x["severity"], 4))



@router.get("/global/summary")
async def get_global_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get aggregated risk dashboard stats across all devices."""
    
    # 1. Active Devices
    devices = db.query(Device).filter(Device.status == 'active').all()
    device_ids = [d.id for d in devices]
    
    if not device_ids:
        return {
            "avg_security_score": 0,
            "total_risks": 0,
            "risky_devices": [],
            "protocol_violations": {"telnet": 0, "ftp": 0, "http": 0}
        }

    # 2. Total Critical/High Risks
    risk_counts = db.query(
        FirewallRule.risk_level,
        func.count(FirewallRule.id)
    ).filter(
        FirewallRule.device_id.in_(device_ids),
        FirewallRule.risk_level.in_(['critical', 'high']),
        FirewallRule.parent_id == None
    ).group_by(FirewallRule.risk_level).all()
    
    risk_map = {r: c for r, c in risk_counts}
    total_severe_risks = risk_map.get('critical', 0) + risk_map.get('high', 0)

    # 3. Top Risky Devices
    # Complex query to count critical risks per device
    # SELECT device_id, count(*) FROM rules WHERE risk='critical' GROUP BY device_id ORDER BY count DESC
    
    risky_devs_query = db.query(
        FirewallRule.device_id,
        func.count(FirewallRule.id).label('critical_count')
    ).filter(
        FirewallRule.device_id.in_(device_ids),
        FirewallRule.risk_level == 'critical',
        FirewallRule.parent_id == None
    ).group_by(FirewallRule.device_id).order_by(func.count(FirewallRule.id).desc()).limit(5).all()
    
    risky_devices = []
    for r_dev_id, r_count in risky_devs_query:
        dev_name = next((d.name for d in devices if d.id == r_dev_id), "Unknown")
        risky_devices.append({
            "id": str(r_dev_id),
            "name": dev_name,
            "critical_issues": r_count
        })

    # 4. Protocol Violations (Global)
    protocol_stats = {}
    for proto in ['telnet', 'ftp', 'http']:
        count = db.query(FirewallRule).filter(
            FirewallRule.device_id.in_(device_ids),
            FirewallRule.service.ilike(f"%{proto}%"),
            FirewallRule.action == 'allow',
            FirewallRule.parent_id == None
        ).count()
        protocol_stats[proto] = count

    # 5. Calculate Average Security Score (Mock calculation based on risks for now)
    # detailed scoring would be in a separate service, but here's a rough estimate
    # Base 100, minus 5 per critical, minus 2 per high
    
    total_penalty = (risk_map.get('critical', 0) * 5) + (risk_map.get('high', 0) * 2)
    avg_penalty_per_device = total_penalty / len(devices) if devices else 0
    avg_score = max(0, 100 - avg_penalty_per_device)

    return {
        "avg_security_score": round(avg_score, 1),
        "total_active_devices": len(devices),
        "total_severe_risks": total_severe_risks,
        "risky_devices": risky_devices,
        "protocol_violations": protocol_stats
    }
