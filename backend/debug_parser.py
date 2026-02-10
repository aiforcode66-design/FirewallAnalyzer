
from app.services.parser import ConfigParser
import json

content = """
access-list INSIDE-IN extended deny object-group TCPUDP any any object-group DM_INLINE_TCPUDP_1 
access-list INSIDE-IN extended deny object-group TCPUDP any any eq 3389 
access-list INSIDE-IN extended permit ip any any 
access-list INSIDE-IN extended permit icmp any any 
access-list OUTSIDE-IN extended deny object-group TCPUDP any any eq 3389 
access-list OUTSIDE-IN extended permit ip any 10.20.8.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip any 10.20.9.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip any 10.20.10.0 255.255.254.0 
access-list OUTSIDE-IN extended permit ip any 10.20.22.0 255.255.254.0 
access-list OUTSIDE-IN extended permit ip any 10.20.24.0 255.255.254.0 
access-list OUTSIDE-IN extended permit ip any 10.20.28.0 255.255.254.0 
access-list OUTSIDE-IN extended permit ip any 10.20.220.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 216.239.35.12 host 10.8.254.200 
access-list OUTSIDE-IN extended permit ip any 10.20.128.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip 10.150.0.0 255.255.252.0 any 
access-list OUTSIDE-IN extended permit ip 10.20.20.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip 10.20.90.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip host 10.20.66.23 host 10.20.50.14 
access-list OUTSIDE-IN extended permit ip host 10.20.66.23 host 10.20.50.110 
access-list OUTSIDE-IN extended permit ip host 10.20.66.23 host 10.20.66.21 
<--- More --->              access-list OUTSIDE-IN extended permit ip host 10.20.66.23 host 10.20.66.22 
access-list OUTSIDE-IN extended permit ip 192.168.234.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip host 10.151.0.2 any 
access-list OUTSIDE-IN remark TP Profiles Series Surabaya
access-list OUTSIDE-IN extended permit ip host 66.96.237.196 host 10.2.60.80 
access-list OUTSIDE-IN extended permit ip 192.168.105.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit tcp any host 10.10.52.51 eq domain 
access-list OUTSIDE-IN extended permit udp any host 10.10.52.51 eq domain 
access-list OUTSIDE-IN extended permit tcp host 61.8.77.122 eq ssh host 10.10.52.51 
access-list OUTSIDE-IN extended permit tcp host 61.8.77.122 eq 4353 host 10.10.52.51 
access-list OUTSIDE-IN extended permit tcp host 202.152.22.100 eq domain host 10.10.52.51 
access-list OUTSIDE-IN extended permit tcp host 202.152.5.36 eq domain host 10.10.52.51 
access-list OUTSIDE-IN extended permit tcp host 61.8.77.122 host 10.10.52.51 eq ssh 
access-list OUTSIDE-IN extended permit tcp host 61.8.77.122 host 10.10.52.51 eq 4353 
access-list OUTSIDE-IN remark SITE-TO-SITE-VPN-DC-DRC
access-list OUTSIDE-IN extended permit ip 10.120.50.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip 10.120.53.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip 10.120.65.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip 10.120.63.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip host 10.150.0.254 any 
access-list OUTSIDE-IN extended permit ip host 137.59.125.45 host 10.20.50.31 
access-list OUTSIDE-IN extended permit ip host 137.59.125.45 host 10.20.50.32 
access-list OUTSIDE-IN extended permit tcp any eq ssh host 10.20.50.138 
access-list OUTSIDE-IN extended permit tcp any eq ssh host 10.20.50.139 
<--- More --->              access-list OUTSIDE-IN extended permit tcp any eq https host 10.20.50.138 
access-list OUTSIDE-IN extended permit tcp any eq https host 10.20.50.139 
access-list OUTSIDE-IN extended permit icmp any host 10.20.50.138 
access-list OUTSIDE-IN extended permit icmp any host 10.20.50.139 
access-list OUTSIDE-IN extended permit ip 192.168.235.0 255.255.255.192 any 
access-list OUTSIDE-IN extended permit ip any 10.20.30.0 255.255.254.0 
access-list OUTSIDE-IN extended permit tcp any host 10.20.65.100 eq domain 
access-list OUTSIDE-IN extended permit tcp any host 10.20.65.101 eq domain 
access-list OUTSIDE-IN extended permit tcp any host 10.20.65.100 eq https 
access-list OUTSIDE-IN extended permit tcp any host 10.20.65.101 eq https 
access-list OUTSIDE-IN extended permit tcp any host 10.20.54.1 eq https 
access-list OUTSIDE-IN extended permit tcp any host 10.20.50.61 eq https 
access-list OUTSIDE-IN extended permit ip any 10.20.12.0 255.255.255.192 
access-list OUTSIDE-IN extended permit ip any 10.20.52.64 255.255.255.224 
access-list OUTSIDE-IN extended permit ip any 10.20.12.64 255.255.255.224 
access-list OUTSIDE-IN extended permit ip 10.170.10.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip host 10.150.3.200 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 10.150.3.201 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 10.150.3.208 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 10.150.3.212 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 10.20.66.26 host 10.20.50.14 
access-list OUTSIDE-IN extended permit ip host 10.20.66.26 host 10.20.50.110 
access-list OUTSIDE-IN extended permit ip host 10.20.66.26 host 10.20.66.21 
access-list OUTSIDE-IN extended permit ip host 10.20.66.26 host 10.20.66.22 
<--- More --->              access-list OUTSIDE-IN extended permit ip 10.150.15.0 255.255.255.0 any 
access-list OUTSIDE-IN extended permit ip host 10.150.3.46 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 10.150.3.225 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip host 10.150.3.226 10.30.2.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip 10.150.21.0 255.255.255.192 any 
access-list OUTSIDE-IN extended permit ip any 10.8.251.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip any 10.8.252.0 255.255.255.0 
access-list OUTSIDE-IN remark MSI-SDA
access-list OUTSIDE-IN extended permit ip any 10.20.32.0 255.255.252.0 
access-list OUTSIDE-IN extended permit ip any 10.20.26.0 255.255.255.0 
access-list OUTSIDE-IN extended permit ip any 10.20.56.0 255.255.255.224 
access-list OUTSIDE-IN extended permit ip any 10.20.52.0 255.255.255.240 
access-list OUTSIDE-IN extended permit ip host 10.150.51.243 host 10.30.2.40 
access-list OUTSIDE-IN extended permit tcp any host 10.20.65.102 eq domain 
access-list OUTSIDE-IN extended permit tcp any host 10.20.65.102 eq https 
access-list SKN extended permit ip 10.164.8.0 255.255.255.0 any 
access-list SKN extended permit ip any 10.164.8.0 255.255.255.0 
"""

rules = ConfigParser.parse_rules("cisco", content)

print(f"Total Rules Parsed: {len(rules)}")

# Find specific rule for diagnosis
target_ip = "10.150.0.0"
found_target = False
for i, rule in enumerate(rules):
    if target_ip in rule['raw']:
        found_target = True
        print(f"\n--- Targeted Rule Inspection (Index {i}) ---")
        print(f"Raw: {rule['raw']}")
        print(f"Parsed Source: {rule['source']}")
        print(f"Parsed Dest:   {rule['destination']}")
        print(f"Parsed Action: {rule['action']}")
        print(f"Parsed Svc:    {rule['service']}")
        
        if rule['source'] == 'any' and rule['destination'] == 'any':
             print("!!! CRITICAL: PARSED AS ANY-ANY !!!")
        else:
             print("Parsing looks OK (not Any-Any)")

if not found_target:
    print(f"Could not find rule containing {target_ip}")

