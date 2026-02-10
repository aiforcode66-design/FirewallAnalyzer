
import unittest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.app.services.traffic_analyzer import TrafficAnalyzerService

class MockRule:
    def __init__(self, id, source, destination, service, action, name="Rule"):
        self.id = id
        self.source = source
        self.destination = destination
        self.service = service
        self.action = action
        self.name = name

class TestTrafficAnalyzer(unittest.TestCase):
    def setUp(self):
        self.analyzer = TrafficAnalyzerService()
        self.rules = [
            MockRule(id="1", name="Rule A", action="permit", source="192.168.1.0/24", destination="10.0.0.0/24", service="tcp/80"),
            # Rule 1: Over-Permissive Rule (Allow ANY to HTTP Server) - Should be checked before ANY-ANY
            MockRule("rule1", "any", "10.0.0.50/32", "any", "permit", "Permissive Web Access"),
            # Rule 2: Specific Rule
            MockRule("rule2", "192.168.1.10/32", "10.0.0.53/32", "udp/53", "permit", "DNS Server"),
            # Rule 3: Deny
            MockRule("rule3", "any", "any", "ip", "deny", "Default Deny"),
            # Rule B: Broad Any-Any (Should be last)
            MockRule(id="2", name="Rule B", action="permit", source="any", destination="any", service="any")
        ]

    def test_hit_counting_accuracy(self):
        """ Strict test to verify no double counting """
        parsed_logs = [{
            "timestamp": "Feb 05 2026 12:09:08",
            "syslog_id": "302013",
            "action": "allow",
            "proto": "tcp",
            "src_ip": "192.168.1.10",
            "dst_ip": "10.0.0.50",
            "dst_port": "80",
            "bytes": 100
        }]

        result = self.analyzer.analyze_logs("dev1", parsed_logs, self.rules, [])
        stats = result['rule_stats']['1']

        self.assertEqual(stats['hits'], 1, "Should count exactly 1 hit for 1 log")
        self.assertEqual(stats['bytes'], 100, "Should count exactly 100 bytes for 1 log")
        self.assertEqual(result['total_logs'], 1, "Total logs should be 1")

    def test_analyzed_logs_optimization(self):
        parsed_logs = []
        
        # Scenario 1: Over-Permissive Logic
        # 10 logs hitting Rule 1 with only TCP/80 and TCP/443
        for i in range(5):
            parsed_logs.append({
                "timestamp": "...", "syslog_id": "302013", "action": "allow", "proto": "tcp",
                "src_ip": "1.2.3.4", "dst_ip": "10.0.0.50", "dst_port": "80", "bytes": 100
            })
            parsed_logs.append({
                "timestamp": "...", "syslog_id": "302013", "action": "allow", "proto": "tcp",
                "src_ip": "5.6.7.8", "dst_ip": "10.0.0.50", "dst_port": "443", "bytes": 100
            })
            
        # Scenario 2: Frequent Deny Pattern
        # 10 Deny logs from 10.10.10.10 -> 10.0.0.100 port 1433 (SQL)
        for i in range(10):
            parsed_logs.append({
                "timestamp": "...", "syslog_id": "106023", "action": "deny", "proto": "tcp",
                "src_ip": "10.10.10.10", "dst_ip": "10.0.0.100", "dst_port": "1433", "bytes": 0
            })

        # Scenario 3: Consolidation (Subnet Grouping)
        # 3 different IPs from 192.168.2.0/24 accessing Server 10.0.0.50
        # Wait, Rule 1 is "any", so they match Rule 1.
        for i in range(1, 4):
            parsed_logs.append({
                "timestamp": "...", "syslog_id": "302013", "action": "allow", "proto": "tcp",
                "src_ip": f"192.168.2.{i}", "dst_ip": "10.0.0.50", "dst_port": "80", "bytes": 100
            })
            
        # Scenario 4: Tighten Scope (Any -> Specific IPs)
        # 5 distinct IPs hitting Rule 1 (which is ANY), but NOT from same subnet
        for ip in ["11.0.0.1", "12.0.0.1", "13.0.0.1", "14.0.0.1", "15.0.0.1"]:
            parsed_logs.append({
                "timestamp": "...", "syslog_id": "302013", "action": "allow", "proto": "tcp",
                "src_ip": ip, "dst_ip": "10.0.0.50", "dst_port": "80", "bytes": 100
            })

        result = self.analyzer.analyze_logs("dev1", parsed_logs, self.rules, [])
        
        # Verify Stats
        stats = result['rule_stats']
        self.assertTrue(stats['rule1']['hits'] >= 10)
        
        # Verify Recommendations
        recs = result['recommendations']
        
        # Check Over-Permissive Advice
        over_permissive = next((r for r in recs if r['type'] == 'over_permissive'), None)
        self.assertIsNotNone(over_permissive, "Should detect over-permissive rule 1")
        self.assertEqual(over_permissive['rule_id'], 'rule1')
        self.assertIn("tcp/80", over_permissive['description'])
        
        # Check Frequent Deny Advice
        freq_deny = next((r for r in recs if r['type'] == 'frequent_deny'), None)
        self.assertIsNotNone(freq_deny, "Should detect frequent deny pattern")
        self.assertIn("10.10.10.10", freq_deny['description'])
        self.assertIn("1433", freq_deny['description'])

        # Check Consolidation Advice
        consolidation = next((r for r in recs if r['type'] == 'consolidation'), None)
        self.assertIsNotNone(consolidation, "Should detect consolidation opportunity (3 IPs from subnet)")
        self.assertIn("192.168.2.0/24", consolidation['suggestion'])
        self.assertTrue(len(consolidation['cli_commands']) > 0, "Consolidation should have CLI commands")
        self.assertIn("object-group network", consolidation['cli_commands'][0])

        # Check Tighten Scope Advice
        tighten = next((r for r in recs if r['type'] == 'tighten_scope'), None)
        self.assertIsNotNone(tighten, "Should detect tighten_scope opportunity")
        self.assertIn("Replace 'any' with a Group Object", tighten['suggestion'])
        self.assertIn("11.0.0.1", tighten['description'])

if __name__ == '__main__':
    unittest.main()
