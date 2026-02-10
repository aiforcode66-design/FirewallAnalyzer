"""Traffic Data model for time-series statistics."""

from sqlalchemy import Column, Integer, BigInteger, DateTime, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.database import Base

class TrafficData(Base):
    """Traffic statistics for dashboard visualization."""
    
    __tablename__ = "traffic_data"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True) # Nullable for aggregate/global stats if needed
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Metrics
    bytes_sent = Column(BigInteger, default=0)
    bytes_received = Column(BigInteger, default=0)
    packets_sent = Column(Integer, default=0)
    packets_received = Column(Integer, default=0)
    
    # Dimensions
    action = Column(String(50), default="permit") # permit/deny/drop
    protocol = Column(String(50), nullable=True)
    
    # Relationships
    device = relationship("Device", backref="traffic_stats")

    def __repr__(self):
        return f"<TrafficData {self.timestamp} - {self.bytes_sent}/{self.bytes_received}>"
