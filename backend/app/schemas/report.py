"""Report and change schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class ReportBase(BaseModel):
    """Base report schema."""
    name: str
    type: str
    device_id: Optional[UUID] = None
    format: str = "pdf"


class ReportCreate(ReportBase):
    """Schema for creating a report."""
    pass


class ReportResponse(ReportBase):
    """Schema for report response."""
    id: UUID
    status: str
    download_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChangeBase(BaseModel):
    """Base change schema."""
    device_id: UUID
    user_email: str
    type: str
    description: str
    rules_affected: Optional[List[str]] = None


class ChangeCreate(ChangeBase):
    """Schema for creating a change."""
    pass


class ChangeUpdate(BaseModel):
    """Schema for updating a change."""
    status: str


class ChangeResponse(ChangeBase):
    """Schema for change response."""
    id: UUID
    timestamp: datetime
    status: str
    rollback_available: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    """Schema for dashboard statistics."""
    total_devices: int = Field(..., serialization_alias="totalDevices")
    active_devices: int = Field(..., serialization_alias="activeDevices")
    total_rules: int = Field(..., serialization_alias="totalRules")
    unused_rules: int = Field(..., serialization_alias="unusedRules")
    optimization_score: int = Field(..., serialization_alias="optimizationScore")
    security_score: int = Field(..., serialization_alias="securityScore")
    recent_analyses: int = Field(..., serialization_alias="recentAnalyses")
    pending_changes: int = Field(..., serialization_alias="pendingChanges")
    unused_objects_count: int = Field(0, serialization_alias="unusedObjectsCount")
