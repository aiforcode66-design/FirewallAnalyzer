
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from uuid import UUID

from app.database import get_db
from app.models.device import Device
from app.models.rule import FirewallRule
from app.services.log_parser import log_parser
from app.services.traffic_analyzer import traffic_analyzer

router = APIRouter(
    prefix="/api/traffic",
    tags=["traffic"],
    responses={404: {"description": "Not found"}},
)

@router.post("/upload/{device_id}", response_model=Dict[str, Any])
async def upload_traffic_log(
    device_id: UUID, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    """
    Upload and analyze traffic logs (Syslog) for optimization insights.
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if not file.filename.endswith('.txt') and not file.filename.endswith('.log'):
        pass # Allow all extensions for now, but warn?
    
    content = await file.read()
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text_content = content.decode('latin-1')
        except:
            raise HTTPException(status_code=400, detail="Invalid file encoding. Please upload UTF-8 text file.")

    # 1. Parse Logs
    parsed_logs = []
    lines = text_content.splitlines()
    for line in lines:
        parsed = log_parser.parse_line(line)
        if parsed:
            parsed_logs.append(parsed)
            
    if not parsed_logs:
        return {
            "message": "No valid traffic logs found in file.",
            "total_lines": len(lines),
            "parsed_count": 0
        }

    # 2. Fetch Rules
    # Order by line number if available? Typically firewall rules are processed top-down.
    # We assume rules are correct in DB or we rely on 'line_number' if we have it.
    # FirewallRule model doesn't explicitly have line_number column in view_file above!
    # Wait, check models/rule.py again... 
    # It has: id, device_id, name, source, destination, service, action...
    # It does NOT have line_number!
    # This is critical for top-down simulation.
    # If line_number is missing, we Must rely on DB insertion order or created_at?
    # Usually `id` is UUID, so random order.
    # WITHOUT LINE NUMBER, TRAFFIC ANALYSIS IS IMPOSSIBLE (Order matters!).
    # Let's check if there is another way to order. Maybe `created_at`?
    # Or maybe I missed `line_number` in `rule.py` view earlier? 
    # I viewed lines 1-54. It seemed complete.
    
    # CRITICAL FINDING: FirewallRule model missing sequence order.
    # I will assume for now we sort by `created_at` ascending (Simulating sequential addition).
    # But ideally, we should add `sequence_id` or `line_number` to `FirewallRule`.
    # I will proceed with `created_at` sorting for now as a best-effort fallback.
    
    # Sort by sequence (ACL line order), fallback to created_at for rules without sequence
    from sqlalchemy import func
    rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id
    ).order_by(
        func.coalesce(FirewallRule.sequence, 999999).asc(),
        FirewallRule.created_at.asc()
    ).all()

    # 3. Analyze
    analysis_result = traffic_analyzer.analyze_logs(
        device_id=str(device_id),
        parsed_logs=parsed_logs,
        rules=rules,
        objects=[] # TODO: Fetch objects if needed
    )
    
    return {
        "device_id": str(device_id),
        "filename": file.filename,
        "summary": analysis_result
    }

@router.get("/analysis/{device_id}")
async def get_analysis_history(device_id: UUID, db: Session = Depends(get_db)):
    """
    Get generic traffic stats (Mocked for now until we persist analysis).
    """
    return {"message": "Analysis history not implemented yet. Please upload a log file."}
