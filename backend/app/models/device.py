"""Device model."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from datetime import datetime
import uuid
from app.database import Base


class Device(Base):
    """Firewall device model."""
    
    __tablename__ = "devices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False)  # IPv6 compatible
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    model = Column(String(255), nullable=True)
    status = Column(String(50), default="inactive", nullable=False)
    last_seen = Column(DateTime, nullable=True)
    rules_count = Column(Integer, default=0, nullable=False)
    location = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    config_date = Column(DateTime, nullable=True) # Timestamp from config file (show clock)
    
    # Parent Device for Multi-Context (Optional)
    parent_device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)

    # Relationships
    # Relationships
    vendor = relationship("Vendor", backref="devices")
    sub_devices = relationship("Device", 
                               backref=backref("parent_device", remote_side=[id]),
                               cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Device {self.name} ({self.ip_address})>"
