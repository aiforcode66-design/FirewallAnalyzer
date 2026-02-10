
import sys
import os
import re
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.syslog_parser import CiscoASASyslogParser

def test_acl_hit_parsing():
    print("Testing ACL Hit Parsing with Interface Prefix...")
    
    # Sample provided by user
    log_line = "%ASA-6-106100: access-list oob-jats permitted udp oob-jats/10.107.1.22(123) -> mon-ntp/172.31.1.20(123) hit-cnt 1 first hit [0xdbbde7b0, 0x00000000]"
    
    # Test regex directly first
    match = CiscoASASyslogParser.PATTERNS['acl_hit'].search(log_line)
    if match:
        print("Regex Match Successful!")
        print(f"ACL: {match.group(1)}")
        print(f"Direction: {match.group(2)}")
        print(f"Proto: {match.group(3)}")
        print(f"Src Intf: {match.group(4)}") # New group
        print(f"Src IP: {match.group(5)}")
        print(f"Dst Intf: {match.group(7)}") # New group
        print(f"Dst IP: {match.group(8)}")
    else:
        print("Regex Match FAILED")
        return

    # Test parser method
    parsed = CiscoASASyslogParser._parse_line(log_line)
    if parsed:
        print("\nParsed Object:")
        print(parsed)
        
        # Assertions
        assert parsed['src_zone'] == 'oob-jats', f"Expected src_zone 'oob-jats', got {parsed.get('src_zone')}"
        assert parsed['src_ip'] == '10.107.1.22', f"Expected src_ip '10.107.1.22', got {parsed.get('src_ip')}"
        print("\nAssertions Passed!")
    else:
        print("Parsing FAILED")

if __name__ == "__main__":
    test_acl_hit_parsing()
