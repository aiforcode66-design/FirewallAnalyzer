from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Text, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
import uuid
from app.database import Base

# Association table for Group Members (Many-to-Many self-referentialish)
# A group can contain objects or other groups.
# For simplicity, we might link to a "base" object if we used polymorphism, 
# but here we'll just store links to specific tables or use a generic "member_name" for resolution.
# Better approach for SQL: 
# Group -> Members (Objects)
# Group -> SubGroups (Groups)

group_objects_association = Table(
    'group_object_members',
    Base.metadata,
    Column('group_id', UUID(as_uuid=True), ForeignKey('object_groups.id', ondelete="CASCADE")),
    Column('object_id', UUID(as_uuid=True), ForeignKey('firewall_objects.id', ondelete="CASCADE"))
)

group_groups_association = Table(
    'group_group_members',
    Base.metadata,
    Column('parent_group_id', UUID(as_uuid=True), ForeignKey('object_groups.id', ondelete="CASCADE")),
    Column('member_group_id', UUID(as_uuid=True), ForeignKey('object_groups.id', ondelete="CASCADE"))
)

class FirewallObject(Base):
    """
    Represents an atomic firewall object (Host, Network, Range, Service).
    """
    __tablename__ = "firewall_objects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False) # host, network, range, service-tcp, service-udp, etc.
    value = Column(Text, nullable=True) # 192.168.1.1, 10.0.0.0/8, etc.
    description = Column(Text, nullable=True)
    
    is_unused = Column(Boolean, default=True) # Default to Unused until proven otherwise
    
    # Relationships
    device = relationship("Device", backref=backref("objects", cascade="all, delete-orphan"))
    
    def __repr__(self):
        return f"<FirewallObject {self.name} ({self.type})>"


class ObjectGroup(Base):
    """
    Represents a group of objects (Network Group, Service Group).
    """
    __tablename__ = "object_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False) # network-group, service-group
    description = Column(Text, nullable=True)
    
    is_unused = Column(Boolean, default=True)
    
    # Relationships
    device = relationship("Device", backref=backref("object_groups", cascade="all, delete-orphan"))
    
    # Members
    member_objects = relationship(
        "FirewallObject",
        secondary=group_objects_association,
        backref="parent_groups"
    )
    
    sub_groups = relationship(
        "ObjectGroup",
        secondary=group_groups_association,
        primaryjoin=id==group_groups_association.c.parent_group_id,
        secondaryjoin=id==group_groups_association.c.member_group_id,
        backref="parent_groups"
    )

    def __repr__(self):
        return f"<ObjectGroup {self.name} ({self.type})>"
