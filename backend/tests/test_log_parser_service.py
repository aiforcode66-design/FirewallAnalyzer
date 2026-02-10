
import unittest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.app.services.log_parser import LogParserService

class TestLogParser(unittest.TestCase):
    def setUp(self):
        self.parser = LogParserService()

    def test_conn_outbound(self):
        log = "Feb 05 2026 12:09:08: %ASA-6-302013: Built outbound TCP connection 660243732 for OUTSIDE:163.70.158.61/5222 (163.70.158.61/5222) to INSIDE:10.20.22.133/52624 (10.20.22.133/52624)"
        result = self.parser.parse_line(log)
        # Outbound logic: Source is INSIDE, Dest is OUTSIDE
        self.assertEqual(result['action'], 'allow')
        self.assertEqual(result['src_ip'], '10.20.22.133')
        self.assertEqual(result['dst_ip'], '163.70.158.61')
        self.assertEqual(result['syslog_id'], '3020xx')

    def test_conn_teardown_outbound(self):
        log = "Feb 05 2026 12:09:08: %ASA-6-302014: Teardown TCP connection 660242307 for OUTSIDE:17.138.175.254/443 to INSIDE:10.20.31.16/53257 duration 0:02:01 bytes 12640 TCP FINs from INSIDE"
        result = self.parser.parse_line(log)
        self.assertEqual(result['action'], 'allow')
        # Without direction, parser defaults to first entity -> source
        # So Src=OUTSIDE(17.138...), Dst=INSIDE(10.20...)
        self.assertEqual(result['src_ip'], '17.138.175.254') 
        self.assertEqual(result['dst_ip'], '10.20.31.16')
        self.assertEqual(result['bytes'], 12640)
        self.assertEqual(result['direction'], 'unknown')

    def test_conn_inbound(self):
        log = "Feb 05 2026 12:09:09: %ASA-6-302015: Built inbound UDP connection 660243734 for OUTSIDE:10.170.10.142/63295 (10.170.10.142/63295) to INSIDE:10.20.65.103/53 (10.20.65.103/53)"
        result = self.parser.parse_line(log)
        # Inbound logic: Source is OUTSIDE, Dest is INSIDE
        self.assertEqual(result['action'], 'allow')
        self.assertEqual(result['src_ip'], '10.170.10.142')
        self.assertEqual(result['dst_ip'], '10.20.65.103')

    def test_conn_teardown_inbound(self):
        log = "Feb 05 2026 12:09:09: %ASA-6-302016: Teardown UDP connection 660243734 for OUTSIDE:10.170.10.142/63295 to INSIDE:10.20.65.103/53 duration 0:00:00 bytes 177"
        result = self.parser.parse_line(log)
        self.assertEqual(result['action'], 'allow')
        self.assertEqual(result['src_ip'], '10.170.10.142')
        self.assertEqual(result['dst_ip'], '10.20.65.103')
        self.assertEqual(result['bytes'], 177)

    def test_deny_106023(self):
        log = "Feb 05 2026 12:09:09: %ASA-4-106023: Deny icmp src OUTSIDE:10.1.0.162 dst INSIDE:10.20.50.110 (type 3, code 1) by access-group \"OUTSIDE-IN\" [0x0, 0x0]"
        result = self.parser.parse_line(log)
        self.assertEqual(result['action'], 'deny')
        self.assertEqual(result['src_ip'], '10.1.0.162')
        self.assertEqual(result['dst_ip'], '10.20.50.110')
        self.assertEqual(result['proto'], 'icmp')

if __name__ == '__main__':
    unittest.main()
