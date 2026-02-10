"""Device router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from uuid import UUID
from datetime import datetime, timedelta
from app.database import get_db
from app.models.device import Device
from app.models.vendor import Vendor
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceResponse, VendorCreate, VendorResponse
from app.auth.dependencies import get_current_user
from fastapi import UploadFile, File
from app.models.device_config import DeviceConfig
from app.models.rule import FirewallRule
from app.schemas.rule import FirewallRuleResponse
from app.services.parser import ConfigParser
import re

router = APIRouter(prefix="/api/devices", tags=["Devices"])


@router.get("", response_model=List[DeviceResponse])
async def get_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all devices."""
    devices = db.query(Device).all()
    return devices


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get device by ID."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    return device


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    device_data: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new device."""
    print(f"[DEBUG] create_device called with: {device_data.model_dump()}")
    
    # Verify vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == device_data.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Create device
    new_device = Device(**device_data.model_dump())
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    return new_device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: UUID,
    device_data: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update device."""
    
    # Find device
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Update fields
    update_data = device_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    
    device.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(device)
    
    return device


from app.models.change import Change
from app.models.analysis import Analysis
from app.models.object import FirewallObject, ObjectGroup
from app.models.report import Report

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete device."""
    
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # 1. Handle Child Devices (Contexts) first
    child_devices = db.query(Device).filter(Device.parent_device_id == device_id).all()
    for child in child_devices:
        # Delete related records for child (Bulk delete for performance)
        db.query(DeviceConfig).filter(DeviceConfig.device_id == child.id).delete(synchronize_session=False)
        db.query(Analysis).filter(Analysis.device_id == child.id).delete(synchronize_session=False)
        # Note: Findings cascade from Analysis
        
        # Delete Objects & Groups
        db.query(ObjectGroup).filter(ObjectGroup.device_id == child.id).delete(synchronize_session=False)
        db.query(FirewallObject).filter(FirewallObject.device_id == child.id).delete(synchronize_session=False)
        
        # Delete reports
        db.query(Report).filter(Report.device_id == child.id).delete(synchronize_session=False)

        # Delete rules (synchronize_session=False is faster and avoids relationship loading issues)
        db.query(FirewallRule).filter(FirewallRule.device_id == child.id).delete(synchronize_session=False)
        
        db.query(Change).filter(Change.device_id == child.id).delete(synchronize_session=False)
        # Delete child device
        db.delete(child)

    # 2. Delete related records for Parent
    db.query(DeviceConfig).filter(DeviceConfig.device_id == device_id).delete(synchronize_session=False)
    db.query(Analysis).filter(Analysis.device_id == device_id).delete(synchronize_session=False)
    
    # Delete Objects & Groups
    db.query(ObjectGroup).filter(ObjectGroup.device_id == device_id).delete(synchronize_session=False)
    db.query(FirewallObject).filter(FirewallObject.device_id == device_id).delete(synchronize_session=False)
    
    # Delete reports
    db.query(Report).filter(Report.device_id == device_id).delete(synchronize_session=False)

    db.query(FirewallRule).filter(FirewallRule.device_id == device_id).delete(synchronize_session=False)
    db.query(Change).filter(Change.device_id == device_id).delete(synchronize_session=False)
    
    # 3. Delete Parent
    db.delete(device)
    db.commit()
    
    return None


@router.get("/{device_id}/objects", response_model=Any)
async def get_device_objects(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get extracted objects from device configuration."""
    # 1. Verify Device
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # 2. Get Config
    config = db.query(DeviceConfig).filter(DeviceConfig.device_id == device_id).first()
    if not config or not config.content:
        # If no config (maybe legacy?), return empty or try to infer from rules?
        # For migration wizard, we safer return empty list.
        return []
        
    # 3. Parse Objects
    try:
        if isinstance(config.content, bytes):
             content_str = config.content.decode('utf-8', errors='ignore')
        else:
             content_str = config.content
             
        objects = ConfigParser.extract_objects(device.vendor.name, content_str)
        return objects
    except Exception as e:
        print(f"Error extracting objects: {e}")
        return []


@router.get("/{device_id}/rules", response_model=List[FirewallRuleResponse])
async def get_device_rules(
    device_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all rules for a device."""
    # 1. Verify Device
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # 2. Fetch Rules (ordered by sequence)
    from sqlalchemy import func
    rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None  # Only top-level rules; children are loaded via relationship
    ).order_by(
        func.coalesce(FirewallRule.sequence, 999999).asc()
    ).offset(skip).limit(limit).all()
    
    # 3. Serialize (or rely on response_model if strict)
    # Since we used List[Any], we can return list of dicts or objects
    return rules

@router.post("/{device_id}/config", status_code=status.HTTP_201_CREATED)
async def upload_device_config(
    device_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload device configuration file."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    content = await file.read()
    
    # Check file type
    is_zip = file.filename.endswith('.zip')
    
    from app.services.zip_parser import ZipParser
    contexts = {}
    
    if is_zip:
        # 1. Extract ZIP
        try:
            files = ZipParser.extract_zip(content)
            if not files:
                 raise HTTPException(status_code=400, detail="Empty ZIP file")
            contexts = ZipParser.identify_context_files(files)
        except Exception as e:
             raise HTTPException(status_code=400, detail=f"Invalid ZIP: {str(e)}")
             
    else:
        # 2. Text File Processing
        try:
            content_str = content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                content_str = content.decode('latin-1')
            except:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid file format. Please upload a structured text file or ZIP."
                )

        # Check for Multi-Context Pattern
        # We assume if the pattern exists, we treat it as multi-context
        dummy_files = {file.filename: content_str}
        contexts = ZipParser.identify_context_files(dummy_files)
        
        # Validation: If identifying contexts returned nothing OR 
        # it just returned the file itself as a 'context' but didn't actually split it (fallback logic), 
        # we might want to stick to legacy single-file mode if it's just a standard config.
        # However, ZipParser.identify_context_files now has logic to split by delimiters.
        # If it found delimiters, we should process as contexts.
        # Check if we have multiple contexts OR if the context name matches a known context.
        
        # Simple heuristic: If identify_context_files returns valid data, we TRY to process as contexts.
        # But for the "Legacy" fallback (where it just returns hostname -> content), 
        # existing users might be confused if their single device update suddenly creates a child device named "MyHostname".
        
        # We only force Multi-Context flow if we are SURE it's a multi-context file (found delimiters) 
        # OR if it's a ZIP.
        # For text files, checking if ZipParser found delimiters is hard because identifying logic is internal.
        # Let's peek at the content ourselves for the delimiter regex, or trust ZipParser.
        
        has_delimiters = bool(re.search(r'hostname\s+[^\s]+\s*\n.*?\n\s*:\s*end', content_str, re.DOTALL | re.IGNORECASE))
        
        if not has_delimiters:
             # LEGACY FLOW: Update Parent
             return _process_legacy_upload(db, device, file.filename, content_str)

    # 3. Process Contexts (Common for ZIP & Text)
    if not contexts:
        raise HTTPException(status_code=400, detail="No valid configuration contexts found in file.")

    return _process_contexts(db, device, contexts, file.filename)


def _process_legacy_upload(db: Session, device: Device, filename: str, content: str):
    """Handle standard single-file configuration upload."""
    config = DeviceConfig(
        device_id=device.id,
        filename=filename,
        content=content
    )
    db.add(config)
    
    # Extract timestamp
    from app.services.zip_parser import ZipParser
    ts = ZipParser.extract_backup_timestamp(content)
    if ts:
        device.config_date = ts
    
    # Parse config and update stats
    # Parse config and update stats
    # Parse config and update stats
    try:
        # 1. Parse & Ingest Objects (NEW)
        from app.services.object_service import ObjectService
        extracted_objects = ConfigParser.extract_objects(device.vendor.name, content)
        ObjectService.ingest_objects(db, device.id, extracted_objects)

        # 2. Parse & Ingest Rules
        parsed_data = ConfigParser.parse(device.vendor.name, content)
        if "rules_count" in parsed_data:
            device.rules_count = parsed_data["rules_count"]
            
        # CLEAR EXISTING RULES & SAVE NEW ONES
        db.query(FirewallRule).filter(FirewallRule.device_id == device.id).delete()
        
        rules_to_create = []
        if "rules_data" in parsed_data:
            for r in parsed_data["rules_data"]:
                def create_rule(data):
                    return FirewallRule(
                        device_id=device.id,
                        name=str(data.get("name", "Unknown"))[:255],
                        source=str(data.get("source", "any"))[:500],
                        destination=str(data.get("destination", "any"))[:500],
                        service=str(data.get("service", "any"))[:255],
                        action=str(data.get("action", "deny"))[:50],
                        hits=int(data.get("hits", 0)),
                        sequence=data.get("sequence"),  # ACL line order
                        last_hit=data.get("last_hit"), # Correctly use parsed value
                        is_unused=(int(data.get("hits", 0)) == 0), 
                        is_redundant=False,
                        is_shadowed=False,
                        risk_level=data.get("risk", "low"),
                        rule_hash=data.get("hash")[:64] if data.get("hash") else None
                    )
                
                parent = create_rule(r)
                if r.get("children"):
                    for child_data in r["children"]:
                        parent.children.append(create_rule(child_data))
                
                rules_to_create.append(parent)
        
        if rules_to_create:
            db.add_all(rules_to_create)
            db.flush() # Ensure rules are in DB for analysis
            
        # 3. Analyze Object Usage (NEW)
        ObjectService.analyze_usage(db, device.id)
            
        device.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(config)
            
    except Exception as e:
        db.rollback()
        print(f"Parsing/Saving error: {e}")
        # Re-raise to alert user
        raise HTTPException(status_code=500, detail=f"Failed to process config: {str(e)}")
    
    return {
        "id": config.id, 
        "filename": config.filename, 
        "message": "Config uploaded successfully",
        "stats": {
            "rules_detected": device.rules_count
        }
    }


def _process_contexts(db: Session, device: Device, contexts: dict, filename: str):
    """Process extracted contexts and update child devices."""
    processed_contexts = []
    
    # Try to find timestamp in any context
    from app.services.zip_parser import ZipParser
    found_ts = None
    for data in contexts.values():
        val = (data.get("detailed") or "") + "\n" + (data.get("config") or "")
        found_ts = ZipParser.extract_backup_timestamp(val)
        if found_ts: break
    
    if found_ts:
        device.config_date = found_ts
    elif device.config_date:
        # Fallback: Use existing parent config date if no new one found in contexts
        found_ts = device.config_date
    
    for ctx_name, data in contexts.items():
        config_text = data.get("config", "")
        brief_text = data.get("brief", "")
        
        # Skip if no config
        if not config_text: continue
        
        # Create/Update Child Device (Context)
        child_device = db.query(Device).filter(
            Device.parent_device_id == device.id,
            Device.name == ctx_name
        ).first()
        
        if not child_device:
            child_device = Device(
                name=ctx_name,
                ip_address=device.ip_address,
                vendor_id=device.vendor_id,
                model=f"{device.model} (Context)",
                status="active",
                location=device.location,
                parent_device_id=device.id,
                description=f"Virtual Context extracted from {filename}"
            )
            db.add(child_device)
            db.commit()
            db.refresh(child_device)
        
        # Sync timestamp from parent/found config
        if found_ts:
            child_device.config_date = found_ts
        
        # SAVE RAW CONFIG FOR CHILD CONTEXT (Critical for Migration)
        # Clear old config first
        db.query(DeviceConfig).filter(DeviceConfig.device_id == child_device.id).delete()
        
        # Determine best content for storage and analysis
        detailed_text = data.get("detailed", "")
        # If detailed text exists (show access-list), use it as primary config for analysis purposes
        target_for_parsing = detailed_text if detailed_text else config_text
        
        new_config = DeviceConfig(
            device_id=child_device.id,
            filename=f"{ctx_name}.cfg", # Synthesize filename
            content=target_for_parsing # Save detailed content (ACLs) so Analyzer can use it later
        )
        db.add(new_config)
        
        # 1. Parse & Ingest Objects (NEW)
        from app.services.object_service import ObjectService
        # ALWAYS use the running config for objects, not the ACL dump
        source_for_objects = config_text if config_text else target_for_parsing
        extracted_objects = ConfigParser.extract_objects(device.vendor.name, source_for_objects)
        ObjectService.ingest_objects(db, child_device.id, extracted_objects)

        # Parse Rules (now includes Hash & Hits)
        # Parse Rules (now includes Hash & Hits)
        # PRIORITIZE DETAILED TEXT (show access-list) because it contains:
        # 1. Hitcounts
        # 2. Expanded Object Groups (Hierarchy/Children) - CRITICAL for user request
        
        parsed_data = ConfigParser.parse(device.vendor.name, target_for_parsing)
        
        # Advanced Stats (Still parsed for fallback/verification, though Parser gets hits now)
        from app.services.zip_parser import ZipParser
        
        # Fallback: if no detailed text separate, maybe config has hits (if it wasn't show tech)
        target_for_hits = detailed_text if detailed_text else config_text
        
        hit_map = ZipParser.parse_detailed_hits(target_for_hits)
        ts_map = ZipParser.parse_access_list_brief(brief_text)
        ts_map = ZipParser.parse_access_list_brief(brief_text)
        
        # Update Rules
        db.query(FirewallRule).filter(FirewallRule.device_id == child_device.id).delete()
        
        rules_to_create = []
        if "rules_data" in parsed_data:
            for r in parsed_data["rules_data"]:
                hits = r.get("hits", 0)
                rule_hash = r.get("hash")
                
                # Base Rule Creation Function
                def create_rule_obj(data, d_id):
                    h_val = data.get("hits", 0)
                    r_h = data.get("hash")
                    new_r = FirewallRule(
                        device_id=d_id,
                        name=data.get("name", "Unknown"),
                        source=data.get("source", "any"),
                        destination=data.get("destination", "any"),
                        service=data.get("service", "any"),
                        action=data.get("action", "deny"),
                        hits=h_val,
                        sequence=data.get("sequence"),  # ACL line order
                        last_hit=data.get("last_hit"), # Correctly use parsed value
                        is_unused=(h_val == 0),
                        is_redundant=False,
                        is_shadowed=False
                    )
                    if r_h:
                         new_r.rule_hash = r_h.lower().replace("0x", "")
                    return new_r

                # Logic to enhance rule with external stats
                def enhance_rule(rule_obj, raw_data):
                     lookup_hash = rule_obj.rule_hash
                     
                     # 1. Brief Map
                     if lookup_hash and lookup_hash in ts_map:
                        stats = ts_map[lookup_hash]
                        if stats.get("hits", 0) > 0:
                            rule_obj.hits = stats["hits"]
                            rule_obj.is_unused = False
                        if stats.get("last_hit"):
                             rule_obj.last_hit = stats["last_hit"]
                     
                     # 2. Detailed Map (Fuzzy)
                     elif rule_obj.hits == 0 and hit_map:
                        raw_rule = raw_data.get("raw", "").strip()
                        matched_hash = None
                    
                        if raw_rule:
                            # Helper for normalization (nested to avoid polluting global scope)
                            def _normalize_cisco_rule(text):
                                text = re.sub(r' line \d+ ', ' ', text)
                                text = re.sub(r'\s*\(?hitcnt=\d+\)?', '', text)
                                text = re.sub(r'\s*0x[0-9a-fA-F]+', '', text)
                                text = re.sub(r'\s*elements', '', text)
                                text = re.sub(r'\s*extended\s*', ' ', text)
                                return re.sub(r'\s+', ' ', text).strip().lower()

                            norm_raw_rule = _normalize_cisco_rule(raw_rule)
                            
                            for h_hash, h_data in hit_map.items():
                                h_raw = h_data.get("raw", "")
                                norm_h_raw = _normalize_cisco_rule(h_raw)
                                
                                if norm_raw_rule == norm_h_raw or norm_raw_rule in norm_h_raw:
                                    matched_hash = h_hash
                                    rule_obj.hits = h_data.get("hits", 0)
                                    if rule_obj.hits > 0:
                                        rule_obj.is_unused = False
                                    break
                                    
                        # If we matched via fuzzy logic, check stats map again with new hash
                        if matched_hash:
                             l_hash = matched_hash.lower().replace("0x", "")
                             if l_hash in ts_map:
                                stats = ts_map[l_hash]
                                if stats.get("last_hit"):
                                    rule_obj.last_hit = stats["last_hit"]
                                if stats.get("hits", 0) > rule_obj.hits:
                                     rule_obj.hits = stats["hits"] # Trust aggregation more
                
                # Main Logic
                parent_rule = create_rule_obj(r, child_device.id)
                enhance_rule(parent_rule, r)
                
                # Handle Children
                if r.get("children"):
                    for child_data in r["children"]:
                        child_rule = create_rule_obj(child_data, child_device.id)
                        enhance_rule(child_rule, child_data)
                        parent_rule.children.append(child_rule)
                
                rules_to_create.append(parent_rule)
        
        if rules_to_create:
            db.add_all(rules_to_create)
            db.flush() # Ensure rules are accessible
            child_device.rules_count = len(rules_to_create)
            
        # 3. Analyze Object Usage (NEW)
        # We need to run this for each context after its rules are staged
        from app.services.object_service import ObjectService
        ObjectService.analyze_usage(db, child_device.id)
            
        processed_contexts.append(ctx_name)
        
    db.commit()
    
    return {
        "id": device.id,
        "filename": filename,
        "message": f"Multi-Context Processed. Created/Updated {len(processed_contexts)} contexts.",
        "stats": {
            "contexts_found": processed_contexts
        }
    }


@router.get("/{device_id}/stats", response_model=Any)
async def get_device_stats(
    device_id: UUID, 
    days: int = 7,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated statistics for a specific device (Overview Page).
    Returns: Security Score, Risk Profile, Optimization Score, Activity Trend.
    """
    from app.schemas.device import DeviceStats, RiskData, ActivityData
    from sqlalchemy import func, case
    
    # 1. Verify Device Exists
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # 2. Aggregations on Firewall Rules
    # Optimization Stats (parent rules only)
    total_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.parent_id == None
    ).count()
    unused_rules = db.query(FirewallRule).filter(
        FirewallRule.device_id == device_id, 
        FirewallRule.is_unused == True,
        FirewallRule.parent_id == None
    ).count()
    
    # Risk Profile
    # Labels: Critical, High, Medium, Low
    
    # NEW LOGIC: Use Findings from latest Analysis (Source of Truth)
    from app.models.analysis import Analysis, Finding
    
    latest_analysis = db.query(Analysis).filter(
        Analysis.device_id == device_id
    ).order_by(Analysis.timestamp.desc()).first()
    
    risk_map = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    
    if latest_analysis:
        findings_counts = db.query(
            Finding.severity,
            func.count(Finding.id)
        ).filter(
            Finding.analysis_id == latest_analysis.id
        ).group_by(Finding.severity).all()
        
        for severity, count in findings_counts:
            if severity:
                risk_map[severity.lower()] = count
    
    # Fallback to Rule Analysis if no specific analysis exists (rare)
    if not latest_analysis:
        risk_counts = db.query(
            FirewallRule.risk_level, 
            func.count(FirewallRule.id)
        ).filter(
            FirewallRule.device_id == device_id,
            FirewallRule.parent_id == None
        ).group_by(FirewallRule.risk_level).all()
        
        for r in risk_counts:
            if r[0]:
                risk_map[r[0].lower()] = r[1]
    
    # Format for Frontend Recharts
    risk_profile = [
        RiskData(label="Critical", value=risk_map.get("critical", 0), color="#ef4444"),
        RiskData(label="High", value=risk_map.get("high", 0), color="#f97316"),
        RiskData(label="Medium", value=risk_map.get("medium", 0), color="#eab308"),
        RiskData(label="Low", value=risk_map.get("low", 0), color="#22c55e"),
    ]
    
    # Scores Calculation
    # Simple Logic: 
    # Optimization Score = 100 - (Unused %)
    optimizer_score = 100
    if total_rules > 0:
        optimizer_score = int(100 - ((unused_rules / total_rules) * 100))
        
    # Security Score = 100 - Penalty (Critical * 5 + High * 2)
    penalty = (risk_map.get("critical", 0) * 5) + (risk_map.get("high", 0) * 2)
    # Normalize penalty to not go below 0 (and maybe cap it relative to total rules?)
    # For now, let's keep it simple: 100 start, subtract penalty.
    # To avoid negative for large rulebases with many risks, we can be more sophisticated.
    # Let's say max penalty is 100.
    security_score = max(0, 100 - penalty) 

    # NEW: Redundant Rules Count
    redundant_rules_count = 0
    shadowed_rules_count = 0
    if latest_analysis:
        redundant_rules_count = db.query(Finding).filter(
            Finding.analysis_id == latest_analysis.id,
            Finding.type == "redundant"
        ).count()
        shadowed_rules_count = db.query(Finding).filter(
            Finding.analysis_id == latest_analysis.id,
            Finding.type == "shadowed"
        ).count()
    
    # 3. Activity Trend (Last Hit Distribution)
    # Since we don't track daily hits history yet, we use 'last_hit' timestamp distribution.
    # "How many rules were last active on Day X?"
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    activity_query = db.query(
        func.date_trunc('day', FirewallRule.last_hit).label('date'),
        func.count(FirewallRule.id).label('count')
    ).filter(
        FirewallRule.device_id == device_id,
        FirewallRule.last_hit >= start_date,
        FirewallRule.parent_id == None
    ).group_by('date').order_by('date').all()
    
    activity_trend = []
    # Fill in valid dates or just send what we have
    for entry in activity_query:
        if entry.date:
            activity_trend.append(ActivityData(
                date=entry.date.strftime("%a"), # Mon, Tue
                hits=entry.count
            ))
            
    # Fallback if no activity found (mock structure for UI consistency if needed, or empty)
    if not activity_trend:
         # Send empty 7 days for nice chart?
         # For specific request, let's just return empty list or what found.
         pass

    return DeviceStats(
        security_score=security_score,
        risk_profile=risk_profile,
        optimization_score=optimizer_score,
        unused_rules_count=unused_rules,
        redundant_rules_count=redundant_rules_count,
        shadowed_rules_count=shadowed_rules_count,
        total_rules_count=total_rules,
        activity_trend=activity_trend
    )



# Vendor endpoints
vendor_router = APIRouter(prefix="/api/vendors", tags=["Vendors"])


@vendor_router.get("", response_model=List[VendorResponse])
async def get_vendors(db: Session = Depends(get_db)):
    """Get all vendors (no auth required)."""
    vendors = db.query(Vendor).all()
    return vendors


@vendor_router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor_data: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new vendor (admin only)."""
    
    # Check if vendor exists
    existing = db.query(Vendor).filter(Vendor.name == vendor_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor already exists"
        )
    
    new_vendor = Vendor(**vendor_data.model_dump())
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)
    
    return new_vendor


@router.get("/{device_id}/config/download")
async def download_optimized_config(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download optimized configuration file."""
    from fastapi.responses import StreamingResponse
    import io
    from app.services.generator import ConfigGenerator

    # 1. Get Device & Config
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    config = db.query(DeviceConfig).filter(DeviceConfig.device_id == device_id).first()
    if not config or not config.content:
        raise HTTPException(status_code=404, detail="Configuration not found")
        
    # 2. Get Active Rules
    active_rules = db.query(FirewallRule).filter(FirewallRule.device_id == device_id).all()
    
    # 3. Generate Optimized Content
    try:
        if isinstance(config.content, bytes):
            content_str = config.content.decode('utf-8', errors='ignore')
        else:
            content_str = config.content
            
        optimized_content = ConfigGenerator.generate_optimized_config(content_str, active_rules, device.vendor.name)
        
        # 4. Stream Response
        filename = f"optimized_{device.name}.cfg"
        if config.filename:
            base_name = config.filename.rsplit('.', 1)[0]
            filename = f"{base_name}_optimized.cfg"
            
        return StreamingResponse(
            io.StringIO(optimized_content),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        print(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate config: {str(e)}")
@router.get("/{device_id}/config/content")
async def get_device_config_content(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get device configuration content as text."""
    # 1. Verify Device
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # 2. Get Config
    config = db.query(DeviceConfig).filter(DeviceConfig.device_id == device_id).first()
    if not config or not config.content:
        # If no config (maybe legacy?), return empty string
        return {"content": "No configuration file found."}
        
    # 3. Decode if needed
    try:
        if isinstance(config.content, bytes):
            content_str = config.content.decode('utf-8', errors='ignore')
        else:
            content_str = config.content
            
        return {"content": content_str}
    except Exception as e:
        print(f"Error reading config: {e}")
        raise HTTPException(status_code=500, detail="Failed to read configuration content")
