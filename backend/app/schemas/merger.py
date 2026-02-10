from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class RuleBase(BaseModel):
    id: UUID
    name: str
    source: str
    destination: str
    service: str
    action: str
    hits: int

    class Config:
        from_attributes = True

class MergeGroup(BaseModel):
    id: str  # Unique ID for the group (e.g., hash of attributes)
    device_id: UUID
    device_name: str
    common_attributes: dict  # {source, destination, service, action}
    rules: List[RuleBase]
    potential_savings: int
    complexity: str # low, medium, high

class MergeRequest(BaseModel):
    group_ids: List[str]

class MergeResult(BaseModel):
    success: bool
    merged_count: int
    message: str
