from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
from enum import Enum

class ChangeType(str, Enum):
    ADD = "add"
    MODIFY = "modify"
    DELETE = "delete"
    CLEANUP = "cleanup"
    CLEANUP_OBJECTS = "cleanup-objects"
    MERGE = "merge"

class ChangeStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"

class ChangeBase(BaseModel):
    description: str
    type: ChangeType
    device_id: UUID
    rules_affected: Optional[List[Any]] = None

class ChangeCreate(ChangeBase):
    pass

class ChangeUpdate(BaseModel):
    status: Optional[ChangeStatus] = None
    description: Optional[str] = None
    rules_affected: Optional[List[Any]] = None
    rollback_available: Optional[bool] = None

class ChangeResponse(ChangeBase):
    id: UUID
    timestamp: datetime
    user_email: str
    status: ChangeStatus
    rollback_available: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
