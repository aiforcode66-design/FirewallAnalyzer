
import sys
import os
import uuid
from typing import Generator

# Fix path to include backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.routers.tuner import DEVICE_LOG_CACHE

# Global IDs for consistency
device_id_val = uuid.uuid4()
rule_id_val = uuid.uuid4()

# Mock User
def mock_get_current_user():
    class MockUser:
        id = uuid.uuid4()
        email = "test@example.com"
        username = "testuser"
        is_active = True
        role = "admin"
    return MockUser()

# Mock DB Session
def mock_get_db():
    class MockQuery:
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            # Return a Mock Rule
            class MockRule:
                id = rule_id_val
                name = "Test Request"
                rule_hash = "hash123"
                source = "any"
                destination = "any"
                service = "tcp/80"
                action = "permit"
                hits = 100
                device_id = device_id_val
            return MockRule()
        def all(self):
            return []
            
    class MockSession:
        def query(self, model):
            return MockQuery()
        def close(self):
            pass
            
    yield MockSession()

# Override dependencies
app.dependency_overrides[get_current_user] = mock_get_current_user
app.dependency_overrides[get_db] = mock_get_db

client = TestClient(app)

def test_tuner_proposals():
    print(f"Testing Device ID: {device_id_val}")
    print(f"Testing Rule ID: {rule_id_val}")
    
    # 1. Populate Cache manually (Simulating upload)
    print("Populating DEVICE_LOG_CACHE...")
    DEVICE_LOG_CACHE[str(device_id_val)] = [
        {"src_ip": "192.168.1.1", "dst_ip": "10.0.0.1", "protocol": "tcp", "port": 80, "action": "permit"},
        {"src_ip": "192.168.1.2", "dst_ip": "10.0.0.1", "protocol": "tcp", "port": 80, "action": "permit"},
        {"src_ip": "192.168.1.3", "dst_ip": "10.0.0.1", "protocol": "tcp", "port": 80, "action": "permit"}
    ]
    
    # 2. Call Endpoint
    url = f"/api/devices/{device_id_val}/tuner/proposals/{rule_id_val}"
    print(f"GET {url}")
    
    response = client.get(url)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.text}")
    else:
        print("Success! JSON Response:")
        print(response.json())

if __name__ == "__main__":
    test_tuner_proposals()
