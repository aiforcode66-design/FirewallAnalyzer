
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.traffic_analyzer import TrafficAnalyzerService

def test_aggregate_flows():
    print("Testing aggregate_flows...")
    
    # Mock flows
    flows = [
        {"src_ip": "192.168.1.10", "dst_ip": "10.0.0.1", "protocol": "tcp", "port": 80},
        {"src_ip": "192.168.1.11", "dst_ip": "10.0.0.1", "protocol": "tcp", "port": 80},
        {"src_ip": "192.168.1.12", "dst_ip": "10.0.0.1", "protocol": "tcp", "port": 80},
    ]
    
    try:
        proposals = TrafficAnalyzerService.aggregate_flows(flows, density_threshold=0.01) # Low threshold to force aggregation
        print(f"Success! Proposals generated: {len(proposals)}")
        for p in proposals:
            print(p)
    except AttributeError as e:
        print(f"FAILED: AttributeError - {e}")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_aggregate_flows()
