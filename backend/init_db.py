"""Database initialization script."""

from app.database import engine, Base
from app.models import User, Vendor, Device, FirewallRule, Analysis, Finding, Report, Change, FirewallObject, ObjectGroup, TrafficData
from app.auth import hash_password
from sqlalchemy.orm import sessionmaker
import uuid
import random
from datetime import datetime, timedelta

# Create all tables
print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("✓ Tables created successfully!")

# Create session
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    # Check if admin user exists
    admin_exists = db.query(User).filter(User.email == "admin@firewall.com").first()
    
    if not admin_exists:
        # Create admin user
        admin_user = User(
            email="admin@firewall.com",
            password_hash=hash_password("admin123"),
            full_name="Administrator",
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        print("✓ Created admin user (email: admin@firewall.com, password: admin123)")
    else:
        print("✓ Admin user already exists")
    
    # Enforce Supported Vendors
    # We want ONLY: Cisco ASA, Palo Alto, Fortigate, Checkpoint
    target_vendors = {
        "cisco": {
            "display_name": "Cisco ASA",
            "color": "#049fd9",
            "gradient": "from-cyan-500 to-blue-600",
            "features": ["CLI Parsing", "ACL Analysis", "Hit Count Sync"],
            "supported": True
        },
        "paloalto": {
            "display_name": "Palo Alto Networks",
            "color": "#fa582d",
            "gradient": "from-orange-500 to-red-600",
            "features": ["XML API", "App-ID", "Zone Mapping"],
            "supported": True
        },
        "fortinet": {
            "display_name": "Fortinet FortiGate",
            "color": "#ee3135",
            "gradient": "from-red-500 to-rose-600",
            "features": ["FortiOS Config", "VDOM Support"],
            "supported": True
        },
        "checkpoint": {
            "display_name": "Check Point",
            "color": "#e53935",
            "gradient": "from-pink-500 to-rose-500",
            "features": ["R80+ API", "Policy Package"],
            "supported": True # Now Supported
        }
    }

    # 1. Upsert Target Vendors
    for v_name, v_data in target_vendors.items():
        existing = db.query(Vendor).filter(Vendor.name == v_name).first()
        if existing:
            # Update
            existing.display_name = v_data["display_name"]
            existing.color = v_data["color"]
            existing.gradient = v_data["gradient"]
            existing.features = v_data["features"]
            existing.supported = v_data["supported"]
            print(f"✓ Updated vendor: {v_name}")
        else:
            # Insert
            new_vendor = Vendor(
                name=v_name,
                display_name=v_data["display_name"],
                color=v_data["color"],
                gradient=v_data["gradient"],
                features=v_data["features"],
                supported=v_data["supported"]
            )
            db.add(new_vendor)
            print(f"✓ Created vendor: {v_name}")
    
    # 2. Remove Unsupported Vendors (and their devices)
    # Get all vendors not in target list
    vendors_to_remove = db.query(Vendor).filter(Vendor.name.notin_(target_vendors.keys())).all()
    for v in vendors_to_remove:
        # Delete devices first
        devices = db.query(Device).filter(Device.vendor_id == v.id).all()
        if devices:
             print(f"  ⚠ Deleting {len(devices)} devices associated with {v.name}")
             for d in devices:
                 db.delete(d)
        
        print(f"✗ Removing unsupported vendor: {v.name}")
        db.delete(v)

    # 3. Seed Traffic Data (Last 7 Days)
    # Check if traffic data exists
    traffic_count = db.query(TrafficData).count()
    if traffic_count == 0:
        print("Creating dummy traffic history for the last 7 days...")
        today = datetime.utcnow()
        
        # Determine devices to attribute traffic to (or use None for global)
        devices = db.query(Device).all()
        device_ids = [d.id for d in devices] if devices else [None]
        
        for day_offset in range(7, -1, -1): # Last 7 days + today
            current_day = today - timedelta(days=day_offset)
            
            # Generate hourly data
            for hour in range(0, 24, 4): # Every 4 hours to keep it light
                timestamp = current_day.replace(hour=hour, minute=0, second=0, microsecond=0)
                
                # Randomized realistic traffic pattern (peak during day)
                is_peak = 9 <= hour <= 17
                base_traffic = random.randint(500, 1000) if is_peak else random.randint(100, 300)
                
                # Create entry
                entry = TrafficData(
                    timestamp=timestamp,
                    bytes_sent=base_traffic * random.randint(1000, 5000), # MBs
                    bytes_received=base_traffic * random.randint(800, 4000),
                    packets_sent=base_traffic * random.randint(10, 50),
                    packets_received=base_traffic * random.randint(10, 40),
                    action="permit",
                    device_id=random.choice(device_ids) if device_ids else None
                )
                db.add(entry)
                
        print(f"✓ Created traffic history data")
    else:
         print(f"✓ Found {traffic_count} traffic entries")

    db.commit()
    print("\n✅ Database initialization & vendor cleanup completed successfully!")
    print("\nYou can now:")
    print("  1. Run the server: uvicorn app.main:app --reload")
    print("  2. Login with: admin@firewall.com / admin123")
    print("  3. Visit API docs: http://localhost:8000/docs")
    
except Exception as e:
    print(f"\n❌ Error during initialization: {e}")
    db.rollback()
finally:
    db.close()
