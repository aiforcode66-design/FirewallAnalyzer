"""Rule and analysis schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class FirewallRuleBase(BaseModel):
    """Base firewall rule schema."""
    name: str
    source: str
    destination: str
    service: str
    action: str
    hits: int = 0
    last_hit: Optional[datetime] = Field(None, alias="lastHit") # Changed to alias for broader compatibility
    days_unused: Optional[int] = Field(None, alias="daysUnused")
    is_unused: bool = Field(False, alias="isUnused")
    is_redundant: bool = Field(False, alias="isRedundant")
    is_shadowed: bool = Field(False, alias="isShadowed")
    risk_level: Optional[str] = Field(None, alias="riskLevel")


class FirewallRuleCreate(FirewallRuleBase):
    """Schema for creating a rule."""
    device_id: UUID


class FirewallRuleResponse(FirewallRuleBase):
    """Schema for rule response."""
    id: UUID
    device_id: UUID = Field(..., serialization_alias="deviceId")
    created_at: datetime = Field(..., serialization_alias="createdAt")
    children: List['FirewallRuleResponse'] = []
    
    class Config:
        from_attributes = True
        populate_by_name = True # Allow using field names or aliases

# Update forward refs for self-referential model
FirewallRuleResponse.update_forward_refs()


class FindingBase(BaseModel):
    """Base finding schema."""
    type: str
    severity: str
    message: str
    recommendation: str


class FindingCreate(FindingBase):
    """Schema for creating a finding."""
    analysis_id: UUID
    rule_id: Optional[UUID] = None


class FindingResponse(FindingBase):
    """Schema for finding response."""
    id: UUID
    analysis_id: UUID
    rule_id: Optional[UUID]
    rule_content: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AnalysisCreate(BaseModel):
    """Schema for creating an analysis."""
    device_id: UUID
    type: str
    summary: Optional[Dict[str, Any]] = None


class AnalysisResponse(BaseModel):
    """Schema for analysis response."""
    id: UUID
    device_id: UUID
    timestamp: datetime
    type: str
    summary: Optional[Dict[str, Any]]
    findings: List[FindingResponse] = []
    created_at: datetime
    
    class Config:
        from_attributes = True


class UnusedRulesResponse(BaseModel):
    """Schema for unused rules response with total count."""
    items: List[FirewallRuleResponse]
    total: int
