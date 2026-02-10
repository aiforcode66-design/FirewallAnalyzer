"""Device Config model."""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from datetime import datetime
import uuid
from app.database import Base


class DeviceConfig(Base):
    """Device configuration file model."""
    
    __tablename__ = "device_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    device = relationship("Device", backref=backref("configs", cascade="all, delete-orphan"))
    
    def __repr__(self):
        return f"<DeviceConfig {self.filename} ({self.id})>"
