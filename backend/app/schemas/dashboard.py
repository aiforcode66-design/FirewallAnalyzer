from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class DashboardActivity(BaseModel):
    id: str
    type: str  # 'analysis', 'change', 'report', 'alert'
    title: str
    description: str
    timestamp: datetime
    status: str  # 'success', 'warning', 'info', 'error'
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class TrafficPoint(BaseModel):
    name: str # e.g. "Mon", "10:00", etc.
    traffic: int # MB or GB
    rules: int # Rule hits or similar

    class Config:
        from_attributes = True
