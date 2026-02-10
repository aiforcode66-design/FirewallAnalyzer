"""Analysis and findings models."""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from datetime import datetime
import uuid
from app.database import Base


class Analysis(Base):
    """Analysis session model."""
    
    __tablename__ = "analyses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    type = Column(String(50), nullable=False)  # optimization, security, compliance
    summary = Column(JSONB, nullable=True)  # Store summary stats as JSON
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    device = relationship("Device", backref=backref("analyses", cascade="all, delete-orphan"))
    findings = relationship("Finding", back_populates="analysis", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Analysis {self.type} on {self.device_id}>"


class Finding(Base):
    """Analysis finding model."""
    
    __tablename__ = "findings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("firewall_rules.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(50), nullable=False)  # unused, redundant, shadowed, high-risk, optimization
    severity = Column(String(50), nullable=False)  # low, medium, high, critical
    message = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    analysis = relationship("Analysis", back_populates="findings")
    rule = relationship("FirewallRule", backref="findings")
    
    def __repr__(self):
        return f"<Finding {self.type} ({self.severity})>"

    @property
    def rule_content(self):
        """Dynamic property to return the raw rule content from the related rule."""
        if self.rule:
            return f"Rule: {self.rule.action} {self.rule.service} {self.rule.source} -> {self.rule.destination}"
        return None
