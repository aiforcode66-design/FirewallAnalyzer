"""Change model."""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from datetime import datetime
import uuid
from app.database import Base
import enum

class ChangeStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    implemented = "implemented"


class Change(Base):
    """Change tracking model."""
    
    __tablename__ = "changes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_email = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # add, modify, delete
    description = Column(Text, nullable=False)
    rules_affected = Column(JSONB, nullable=True)  # Array of rule IDs
    status = Column(String(50), default="pending", nullable=False)  # pending, approved, rejected, implemented
    rollback_available = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    device = relationship("Device", backref=backref("changes", cascade="all, delete-orphan"))
    
    def __repr__(self):
        return f"<Change {self.type} on {self.device_id} ({self.status})>"
