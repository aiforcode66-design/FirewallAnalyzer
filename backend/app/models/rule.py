"""Firewall rule model."""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from datetime import datetime
import uuid
from app.database import Base


class FirewallRule(Base):
    """Firewall rule model."""
    
    __tablename__ = "firewall_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False, index=True)
    source = Column(String(500), nullable=False)
    destination = Column(String(500), nullable=False)
    service = Column(String(255), nullable=False)
    action = Column(String(50), nullable=False)  # allow, deny
    hits = Column(Integer, default=0, nullable=False)
    sequence = Column(Integer, nullable=True, index=True)  # ACL line number for ordering
    last_hit = Column(DateTime, nullable=True)
    is_unused = Column(Boolean, default=False, nullable=False)
    is_redundant = Column(Boolean, default=False, nullable=False)
    is_shadowed = Column(Boolean, default=False, nullable=False)
    risk_level = Column(String(50), nullable=True)  # low, medium, high, critical
    rule_hash = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Hierarchy
    parent_id = Column(UUID(as_uuid=True), ForeignKey("firewall_rules.id", ondelete="CASCADE"), nullable=True)
    
    # Relationships
    device = relationship("Device", backref=backref("rules", cascade="all, delete-orphan"))
    children = relationship("FirewallRule", 
                          backref=backref("parent", remote_side=[id]),
                          cascade="all, delete-orphan")
    
    @property
    def days_unused(self):
        """Calculate days since last hit or creation."""
        # 1. If never hit (hits=0), it's unused since... ever?
        # Typically we just return None or a special flag. 
        # But if we have no last_hit, we return None.
        if self.last_hit:
            delta = datetime.utcnow() - self.last_hit
            return delta.days
        return None

    def __repr__(self):
        return f"<FirewallRule {self.name} on {self.device_id}>"
