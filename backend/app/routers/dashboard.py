"""Dashboard and statistics router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.device import Device
from app.models.rule import FirewallRule
from app.models.analysis import Analysis
from app.models.change import Change
from app.models.user import User
from app.models.traffic import TrafficData
from app.schemas.report import DashboardStats
from app.schemas.dashboard import DashboardActivity, TrafficPoint
from app.auth.dependencies import get_current_user
from datetime import datetime, timedelta
from sqlalchemy import func
from typing import List
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


from app.models.object import FirewallObject

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard statistics."""
    
    # Count devices
    total_devices = db.query(Device).count()
    active_devices = db.query(Device).filter(Device.status == "active").count()
    
    # Count rules
    total_rules = db.query(FirewallRule).filter(FirewallRule.parent_id == None).count()
    unused_rules = db.query(FirewallRule).filter(
        FirewallRule.is_unused == True,
        FirewallRule.parent_id == None
    ).count()

    # Count unused objects
    unused_objects = db.query(FirewallObject).filter(FirewallObject.is_unused == True).count()
    
    # Count analyses
    recent_analyses = db.query(Analysis).count()
    
    # Count pending changes
    pending_changes = db.query(Change).filter(Change.status == "pending").count()
    
    # Calculate scores
    optimization_score = max(0, min(100, 100 - int((unused_rules / max(total_rules, 1)) * 100)))
    
    high_risk_count = db.query(FirewallRule).filter(FirewallRule.risk_level == "critical").count()
    security_score = max(0, min(100, 100 - int((high_risk_count / max(total_rules, 1)) * 200)))
    
    return {
        "total_devices": total_devices,
        "active_devices": active_devices,
        "total_rules": total_rules,
        "unused_rules": unused_rules,
        "optimization_score": optimization_score,
        "security_score": security_score,
        "recent_analyses": recent_analyses,
        "pending_changes": pending_changes,
        "unused_objects_count": unused_objects
    }

from typing import List
from app.schemas.dashboard import DashboardActivity

@router.get("/activity", response_model=List[DashboardActivity])
async def get_dashboard_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get aggregated recent activity feed."""
    activities = []
    
    # 1. Fetch recent analyses
    analyses = db.query(Analysis).join(Device).order_by(Analysis.timestamp.desc()).limit(5).all()
    for a in analyses:
        # Determine status/color based on findings
        status = "info"
        desc_text = "Analysis completed successfully."
        
        if a.type == "optimization":
             desc_text = "Optimization analysis completed."
             status = "success"
        elif a.type == "compliance":
             desc_text = "Compliance check finished."
             status = "warning"
             
        activities.append(DashboardActivity(
            id=str(a.id),
            type="analysis",
            title=f"Analysis on {a.device.name}",
            description=desc_text,
            timestamp=a.timestamp,
            status=status,
            metadata={"device_id": str(a.device_id)}
        ))

    # 2. Fetch recent changes
    changes = db.query(Change).join(Device).order_by(Change.timestamp.desc()).limit(5).all()
    for c in changes:
        # Map change status to UI status
        ui_status = "info"
        if c.status == "approved": ui_status = "success"
        elif c.status == "rejected": ui_status = "error"
        elif c.status == "pending": ui_status = "warning"
        elif c.status == "implemented": ui_status = "success"
        
        activities.append(DashboardActivity(
            id=str(c.id),
            type="change",
            title=f"Change Request: {c.type.upper()}",
            description=c.description or f"Change request for {c.device.name}",
            timestamp=c.timestamp,
            status=ui_status,
            metadata={"device_id": str(c.device_id), "user": c.user_email}
        ))
        
    # 3. Sort by timestamp descending
    activities.sort(key=lambda x: x.timestamp, reverse=True)
    
    # 4. Return top 10
    return activities[:10]


@router.get("/traffic", response_model=List[TrafficPoint])
async def get_dashboard_traffic(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get traffic trend for the chart."""
    # 1. Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # 2. Aggregate by day
    # Truncate timestamp to day
    trunc_date = func.date_trunc('day', TrafficData.timestamp).label('day')
    
    results = db.query(
        trunc_date,
        func.sum(TrafficData.bytes_received + TrafficData.bytes_sent).label('total_bytes'),
        func.sum(TrafficData.packets_received + TrafficData.packets_sent).label('total_packets')
    ).filter(
        TrafficData.timestamp >= start_date
    ).group_by(trunc_date).order_by(trunc_date).all()
    
    traffic_points = []
    
    # Map results to schema
    for r in results:
        day_str = r.day.strftime("%a") # Mon, Tue, etc.
        # Convert Bytes to MB for readability in chart
        total_mb = int((r.total_bytes or 0) / 1024 / 1024)
        
        traffic_points.append(TrafficPoint(
            name=day_str,
            traffic=total_mb,
            rules=int((r.total_packets or 0) / 100) # Mock rule correlation: 1 rule hit per 100 packets
        ))
        
    return traffic_points


