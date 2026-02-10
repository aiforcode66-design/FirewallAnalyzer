
import re
from datetime import datetime
from typing import Dict, Optional, List

# Syslog formats
# Feb 05 2026 12:09:08: %ASA-6-302013: Built outbound TCP connection ... for OUTSIDE:1.2.3.4/80 (1.2.3.4/80) to INSIDE:5.6.7.8/443 (5.6.7.8/443)
# Feb 05 2026 12:09:08: %ASA-6-302014: Teardown TCP connection ... for OUTSIDE:1.2.3.4/80 to INSIDE:5.6.7.8/443 duration ...
# Feb 05 2026 12:09:09: %ASA-4-106023: Deny icmp src OUTSIDE:10.1.0.162 dst INSIDE:10.20.50.110 (type 3, code 1) ...

class LogParserService:
    def __init__(self):
        # Correctly capture connection log parts (Built or Teardown)
        # 302013-16: Built/Teardown {inbound/outbound} {UPD/TCP} ... for {intf1}:{ip1}/{port1} ... to {intf2}:{ip2}/{port2} ...
        # Note: Teardown often omits direction (Built inbound/outbound vs Teardown TCP).
        self.CONN_REGEX = re.compile(
            r"(?:Built|Teardown)(?:\s+(inbound|outbound))?\s+(\w+)\s+connection\s+\d+\s+for\s+([\w-]+):([\d.]+)/(\d+)(?:\s+\([\d./]+\))?\s+.*to\s+([\w-]+):([\d.]+)/(\d+)(?:\s+\([\d./]+\))?(?:\s+duration\s+(\d+:\d+:\d+)\s+bytes\s+(\d+))?"
        )
        
        # 106023: Deny {proto} src {intf}:{ip} dst {intf}:{ip} ...
        self.DENY_REGEX = re.compile(
            r"Deny\s+(\w+)\s+src\s+([\w-]+):([\d.]+)\s+dst\s+([\w-]+):([\d.]+)"
        )

        # 106100: access-list {name} permitted {proto} {intf}/{ip}({port}) -> {intf}/{ip}({port}) hit-cnt 1 ...
        # or simplified: permitted {proto} {intf}/{ip}({port}) -> {intf}/{ip}({port})
        self.PERMIT_REGEX = re.compile(
            r"access-list\s+[\w-]+\s+permitted\s+(\w+)\s+([\w-]+)/([\d.]+)\((\d+)\)\s+->\s+([\w-]+)/([\d.]+)\((\d+)\)"
        )
        
        self.TIMESTAMP_REGEX = re.compile(r"^(\w+\s+\d+\s+\d+\s+\d+:\d+:\d+)")

    def parse_line(self, line: str) -> Optional[Dict]:
        line = line.strip()
        if not line:
            return None

        # Extract timestamp
        ts_match = self.TIMESTAMP_REGEX.match(line)
        timestamp = ts_match.group(1) if ts_match else datetime.now().strftime("%b %d %Y %H:%M:%S")

        # 1. Connection Logs (3020xx) - Allow
        if "302013" in line or "302014" in line or "302015" in line or "302016" in line:
            match = self.CONN_REGEX.search(line)
            if match:
                direction = match.group(1) # inbound / outbound / None
                proto = match.group(2)     # TCP / UDP
                # Source/Dest logic
                intf1, ip1, port1 = match.group(3), match.group(4), match.group(5)
                intf2, ip2, port2 = match.group(6), match.group(7), match.group(8)
                
                duration = match.group(9)
                bytes_count = int(match.group(10)) if match.group(10) else 0

                src_ip, src_port, src_intf = None, None, None
                dst_ip, dst_port, dst_intf = None, None, None

                # Correct direction logic
                if direction and direction.lower() == "outbound":
                    # Outbound: Inside -> Outside (HighSec -> LowSec)
                    # Log format: ... for DEST_INTF(LowSec):DEST_IP/PORT ... to SRC_INTF(HighSec):SRC_IP/PORT
                    src_ip, src_port, src_intf = ip2, port2, intf2
                    dst_ip, dst_port, dst_intf = ip1, port1, intf1
                elif direction and direction.lower() == "inbound":
                    # Inbound: Outside -> Inside (LowSec -> HighSec)
                    # Log format: ... for SRC_INTF(LowSec):SRC_IP/PORT ... to DEST_INTF(HighSec):DEST_IP/PORT
                    src_ip, src_port, src_intf = ip1, port1, intf1
                    dst_ip, dst_port, dst_intf = ip2, port2, intf2
                else:
                    # Direction Unknown (Teardown usually)
                    # Use Port Heuristic: High Port (>1024) likely Source (Client), Low Port (<1024) likely Dest (Server)
                    p1 = int(port1) if port1.isdigit() else 0
                    p2 = int(port2) if port2.isdigit() else 0
                    
                    if p2 > 1024 and p1 <= 1024:
                       # Likely Outbound: Inside(Client) -> Outside(Server)
                       # Log: ... for Server:p1 ... to Client:p2
                       # So ip2 is Source, ip1 is Dest
                       src_ip, src_port, src_intf = ip2, port2, intf2
                       dst_ip, dst_port, dst_intf = ip1, port1, intf1
                       direction = "outbound (inferred)"
                    elif p1 > 1024 and p2 <= 1024:
                       # Likely Inbound: Outside(Client) -> Inside(Server)
                       # Log: ... for Client:p1 ... to Server:p2
                       # So ip1 is Source, ip2 is Dest
                       src_ip, src_port, src_intf = ip1, port1, intf1
                       dst_ip, dst_port, dst_intf = ip2, port2, intf2
                       direction = "inbound (inferred)"
                    else:
                       # Fallback to default (treat as Inbound-ish order)
                       src_ip, src_port, src_intf = ip1, port1, intf1
                       dst_ip, dst_port, dst_intf = ip2, port2, intf2 
                       direction = "unknown" 

                return {
                    "timestamp": timestamp,
                    "syslog_id": "3020xx",
                    "action": "allow",
                    "proto": proto.lower(),
                    "src_ip": src_ip, "src_port": src_port, "src_intf": src_intf,
                    "dst_ip": dst_ip, "dst_port": dst_port, "dst_intf": dst_intf,
                    "direction": direction if direction else "unknown",
                    "bytes": bytes_count,
                    "duration": duration
                }

        # 2. Deny Logs (106023)
        elif "106023" in line:
            match = self.DENY_REGEX.search(line)
            if match:
                return {
                    "timestamp": timestamp,
                    "syslog_id": "106023",
                    "action": "deny",
                    "proto": match.group(1).lower(),
                    "src_intf": match.group(2), "src_ip": match.group(3), "src_port": "0", # Often ICMP/IP deny has no port
                    "dst_intf": match.group(4), "dst_ip": match.group(5), "dst_port": "0",
                    "bytes": 0
                }

        # 3. Permit Logs (106100)
        elif "106100" in line:
            match = self.PERMIT_REGEX.search(line)
            if match:
                return {
                    "timestamp": timestamp,
                    "syslog_id": "106100",
                    "action": "allow",
                    "proto": match.group(1).lower(),
                    "src_intf": match.group(2), "src_ip": match.group(3), "src_port": match.group(4),
                    "dst_intf": match.group(5), "dst_ip": match.group(6), "dst_port": match.group(7),
                    "bytes": 0
                }
        
        return None

log_parser = LogParserService()
