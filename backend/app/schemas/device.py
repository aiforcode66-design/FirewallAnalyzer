"""Device schemas."""

from pydantic import BaseModel, Field, AliasChoices
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class DeviceBase(BaseModel):
    """Base device schema."""
    name: str = Field(..., min_length=1, max_length=255)
    ip_address: str = Field(
        ..., 
        max_length=45, 
        alias="ipAddress"
    )
    vendor_id: UUID = Field(
        ..., 
        alias="vendorId"
    )
    model: Optional[str] = Field(None, max_length=255)
    status: str = Field(default="inactive", max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None

    class Config:
        populate_by_name = True


class DeviceCreate(DeviceBase):
    """Schema for creating a device."""
    pass


class DeviceUpdate(BaseModel):
    """Schema for updating a device."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    ip_address: Optional[str] = Field(None, max_length=45, validation_alias="ipAddress")
    vendor_id: Optional[UUID] = Field(None, validation_alias="vendorId")
    model: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class DeviceResponse(DeviceBase):
    """Schema for device response."""
    id: UUID
    rules_count: int = Field(default=0, serialization_alias="rulesCount")
    last_seen: Optional[datetime] = Field(None, serialization_alias="lastSeen")
    created_at: datetime = Field(..., serialization_alias="createdAt")
    updated_at: datetime = Field(..., serialization_alias="updatedAt")
    config_date: Optional[datetime] = Field(None, serialization_alias="configDate")
    parent_device_id: Optional[UUID] = Field(None, serialization_alias="parentDeviceId")
    
    vendor: Optional["VendorResponse"] = None

    # Use ForwardRef or just a simplified internal class for lightweight list
    # For sub_devices we often just want ID and Name to avoid full recursion overhead
    sub_devices: Optional[list["DeviceSummary"]] = Field(default=[], serialization_alias="subDevices")

    class Config:
        from_attributes = True
        populate_by_name = True

class DeviceSummary(BaseModel):
    """Lightweight device info (for lists/menus)."""
    id: UUID
    name: str
    status: str
    rules_count: int = Field(default=0, serialization_alias="rulesCount")
    
    class Config:
        from_attributes = True


class VendorBase(BaseModel):
    """Base vendor schema."""
    name: str
    display_name: str = Field(..., serialization_alias="displayName")
    color: Optional[str] = None
    supported: bool = True


class VendorCreate(VendorBase):
    """Schema for creating a vendor."""
    pass


class VendorResponse(VendorBase):
    """Schema for vendor response."""
    id: UUID
    created_at: datetime = Field(..., serialization_alias="createdAt")
    
    class Config:
        from_attributes = True


class RiskData(BaseModel):
    label: str
    value: int
    color: str

class ActivityData(BaseModel):
    date: str
    hits: int

class DeviceStats(BaseModel):
    security_score: int = Field(..., serialization_alias="securityScore")
    risk_profile: List[RiskData] = Field(..., serialization_alias="riskProfile")
    optimization_score: int = Field(..., serialization_alias="optimizationScore")
    unused_rules_count: int = Field(..., serialization_alias="unusedRulesCount")
    redundant_rules_count: int = Field(0, serialization_alias="redundantRulesCount") # Added
    total_rules_count: int = Field(..., serialization_alias="totalRulesCount")
    activity_trend: List[ActivityData] = Field(..., serialization_alias="activityTrend")
