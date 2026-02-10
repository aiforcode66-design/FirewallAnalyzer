from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID, uuid5, NAMESPACE_DNS
import uuid
from datetime import datetime
import json

from app.database import get_db
from app.models.analysis import Analysis, Finding
from app.models.device import Device
from app.models.rule import FirewallRule
from app.schemas.rule import AnalysisCreate, AnalysisResponse, FindingResponse
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.device_config import DeviceConfig
from app.services.parser import ConfigParser
from app.services.analysis_engine import AnalysisEngine
from app.services.report_service import ReportService
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/api/analyzer",
    tags=["analyzer"],
    responses={404: {"description": "Not found"}},
)


@router.post("/start", response_model=AnalysisResponse)
async def start_analysis(
    analysis_in: AnalysisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new analysis for a device.
    Works for both regular devices (with config) and unified devices (migration-created).
    """
    # Check if device exists
    device = db.query(Device).filter(Device.id == analysis_in.device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    timestamp = datetime.utcnow()
    
    # 1. Check for rules in DB first (works for BOTH regular and unified devices)
    db_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device.id,
        FirewallRule.parent_id == None
    ).all()
    
    # 2. If no DB rules, try parsing from config
    config = db.query(DeviceConfig).filter(
        DeviceConfig.device_id == device.id
    ).order_by(DeviceConfig.created_at.desc()).first()
    
    if not db_rules and not config:
        raise HTTPException(
            status_code=400,
            detail="No rules or configuration found for this device. Upload a config or run migration first."
        )
    
    try:
        # Build parsed_rules from DB or config
        if db_rules:
            parsed_rules = []
            for r in db_rules:
                parsed_rules.append({
                    "name": r.name,
                    "source": r.source,
                    "destination": r.destination,
                    "service": r.service,
                    "action": r.action,
                    "hits": r.hits,
                    "last_hit": r.last_hit,
                    "raw": f"Rule: {r.action} {r.service} {r.source} -> {r.destination}",
                    "id": str(r.id)
                })
        else:
            # Fallback: parse from config content
            parsed_rules = ConfigParser.parse_rules(device.vendor.name, config.content)

        stats, findings_list = AnalysisEngine.analyze(parsed_rules)
        
        # Trigger object usage analysis (only if device has objects)
        from app.services.object_service import ObjectService
        try:
            ObjectService.analyze_usage(db, analysis_in.device_id)
        except Exception:
            pass  # Unified devices may not have objects — skip silently
        
        analysis = Analysis(
            device_id=analysis_in.device_id,
            type=analysis_in.type,
            timestamp=timestamp,
            summary=stats
        )
        db.add(analysis)
        db.flush()
        
        for f in findings_list:
            finding = Finding(
                analysis_id=analysis.id,
                type=f["type"],
                severity=f["severity"],
                message=f["message"],
                recommendation=f["recommendation"],
                rule_id=f.get("rule_id")
            )
            db.add(finding)
            
        # If no findings, add an info finding
        if not findings_list:
            db.add(Finding(
                analysis_id=analysis.id,
                type="info",
                severity="low",
                message="Analysis completed. No issues found.",
                recommendation="Continue monitoring."
            ))
            
    except Exception as e:
        print(f"Analysis Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/device/{device_id}", response_model=List[AnalysisResponse])
async def get_device_analyses(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
):
    """Get analysis history for a device."""
    analyses = (
        db.query(Analysis)
        .filter(Analysis.device_id == device_id)
        .order_by(Analysis.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return analyses


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis_details(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get specific analysis details with findings."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return analysis


@router.get("/{analysis_id}/report/csv")
async def get_analysis_csv(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download analysis report as CSV."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    csv_content = ReportService.generate_csv(analysis)
    
    response = StreamingResponse(iter([csv_content]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=report_{analysis_id}.csv"
    return response


@router.get("/{analysis_id}/report/pdf")
async def get_analysis_pdf(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download analysis report as PDF."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    pdf_buffer = ReportService.generate_pdf(analysis)
    
    response = StreamingResponse(pdf_buffer, media_type="application/pdf")
    response.headers["Content-Disposition"] = f"attachment; filename=report_{analysis_id}.pdf"
    return response

@router.get("/{device_id}/shadowed")
async def get_shadowed_rules(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify shadowed rules that are blocked by broader preceding rules.
    """
    from app.services.shadow_detector import ShadowDetectorService
    
    rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None
    ).all()
    
    # Sort by logic if needed, but usually DB order or specific 'sequence' column is relied upon
    # Assuming order in list is order of evaluation for now (or sort by ID if incremental)
    # rules.sort(key=lambda x: x.sequence) 
    
    issues = ShadowDetectorService.detect_shadowed_rules(rules)
    return issues


@router.get("/{device_id}/redundant")
async def get_redundant_rules(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify redundant rules.
    """
    # TODO: Implement RedundancyDetectorService
    # For now return empty list or mock
    return []

@router.get("/{device_id}/unused-objects")
async def get_unused_objects(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify objects (IPs, Services) that are defined but unused in any rule.
    Fetched directly from the database (populated during config upload).
    """
    from app.models.object import FirewallObject, ObjectGroup

    # 1. Fetch Unused Objects
    objs = db.query(FirewallObject).filter(
        FirewallObject.device_id == device_id,
        FirewallObject.is_unused == True
    ).all()
    
    # 2. Fetch Unused Groups
    grps = db.query(ObjectGroup).filter(
        ObjectGroup.device_id == device_id,
        ObjectGroup.is_unused == True
    ).all()
    
    unused = []
    
    for o in objs:
        unused.append({
            "id": str(o.id),
            "name": o.name,
            "type": o.type,
            "value": o.value,
            "reason": "Not referenced in any active rule"
        })
        
    for g in grps:
        unused.append({
            "id": str(g.id),
            "name": g.name,
            "type": g.type,
            "value": f"Group ({len(g.sub_groups) + len(g.member_objects)} members)",
            "reason": "Not referenced in any active rule"
        })

    return unused

@router.get("/{device_id}/critical-risks", response_model=List[FindingResponse])
async def get_critical_risks(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get critical and high severity risks from the latest analysis.
    """
    # Get latest analysis
    analysis = (
        db.query(Analysis)
        .filter(Analysis.device_id == device_id)
        .order_by(Analysis.timestamp.desc())
        .first()
    )
    
    if not analysis:
        # If no analysis exists, we might want to trigger one or return empty
        # For now return empty list
        return []

    # Filter findings for Critical and High/Medium risks relevant to "Critical Analysis"
    # We explicitly look for types added in AnalysisEngine
    risk_types = ["high-risk", "supernet", "risk"] # 'risk' was used for Source Any (Medium)
    
    findings = (
        db.query(Finding)
        .filter(
            Finding.analysis_id == analysis.id,
            Finding.type.in_(risk_types)
        )
        .all()
    )
    
    return findings
    return findings


@router.get("/{device_id}/stats-summary")
async def get_stats_summary(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get summary stats for all optimization categories.
    Combines real-time data (Unused Rules/Objects) with latest Analysis results (Shadowed/Redundant).
    """
    # 1. Unused Rules (Real-time from DB)
    from app.services.cleanup import CleanupService
    # Use default 90 days retention to match UnusedRulesView default
    # This ensures the badge count matches the list view
    unused_rules_result = CleanupService.get_unused_rules(db, device_id, retention_days=90)
    unused_rules_count = unused_rules_result["total"]

    # 2. Unused Objects (Real-time from DB)
    from app.models.object import FirewallObject, ObjectGroup
    unused_objects_count = db.query(FirewallObject).filter(
        FirewallObject.device_id == device_id, 
        FirewallObject.is_unused == True
    ).count()
    
    unused_groups_count = db.query(ObjectGroup).filter(
        ObjectGroup.device_id == device_id,
        ObjectGroup.is_unused == True
    ).count()
    
    total_unused_objects = unused_objects_count + unused_groups_count

    # 3. Complex Analysis (Real-time Calculation for Consistency)
    # We calculate these on-the-fly to ensure they match exactly what is shown in the tabs
    # relying on stored analysis summary can lead to discrepancies if logic differs
    
    # Shadowed Rules
    from app.services.shadow_detector import ShadowDetectorService
    # Need ORM objects for shadow detector
    rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None
    ).all()
    shadow_issues = ShadowDetectorService.detect_shadowed_rules(rules)
    shadowed_count = len(shadow_issues)
    
    # Redundant Rules (Merge Candidates)
    from app.services.merger import MergerService
    merge_candidates = MergerService.identify_candidates(db, device_id)
    # Count total rules in merge candidates (or just number of groups? UI usually shows total rules selectable)
    # MergerListView typically shows number of rules that can be merged.
    # Actually MergerView badge shows 'candidates.length' which is number of GROUPS usually, or rules?
    # Let's check frontend. Frontend MergerView: onUpdateStats(candidates.length)
    # MergerService returns List[MergeGroup]. So we should count groups.
    redundant_count = len(merge_candidates)
    
    # Critical Risks
    # This one usually comes from Analysis findings directly
    critical_count = 0
    latest_analysis = (
        db.query(Analysis)
        .filter(Analysis.device_id == device_id)
        .order_by(Analysis.timestamp.desc())
        .first()
    )
    if latest_analysis and latest_analysis.summary:
        critical_count = latest_analysis.summary.get("highRiskRules", 0)

    return {
        "unusedRules": unused_rules_count,
        "unusedObjects": total_unused_objects,
        "shadowedRules": shadowed_count,
        "redundantRules": redundant_count,
        "criticalRisks": critical_count,
        "hasAnalysis": latest_analysis is not None
    }


@router.post("/objects/cleanup")
async def cleanup_unused_objects(
    object_ids: List[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently delete unused objects and/or groups.
    """
    from app.services.cleanup import CleanupService
    
    result = CleanupService.cleanup_objects(db, object_ids, current_user.email)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
        
    return result
