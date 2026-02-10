
from typing import List, Dict, Any, Optional
import ipaddress
import logging
from collections import defaultdict, Counter
from datetime import datetime

class TrafficAnalyzerService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def analyze_logs(self, device_id: str, parsed_logs: List[Dict], rules: List[Any], objects: List[Any]) -> Dict[str, Any]:
        """
        Analyzes parsed logs against a set of firewall rules to identify rule usage and potential optimizations.
        
        Args:
            device_id: device ID for context
            parsed_logs: list of parsed log dictionaries (from LogParserService)
            rules: list of FirewallRule objects (must be ordered by line_number ASC)
            objects: list of FirewallObject objects (for expanding object-groups if needed)
            
        Returns:
            Dict containing aggregated stats and optimization recommendations:
            - rule_stats: {rule_id: {hits, bytes, last_seen, distinct_services, distinct_sources}}
            - unmatched_logs: count
            - denied_logs: count
            - recommendations: List[{type, severity, description, impacted_rule_id, suggestion, cli_commands}]
        """
        
        # 1. Pre-process rules into a faster lookup structure if possible
        # For now, we will iterate linearly (Top-Down) as per firewall logic.
        # But we can pre-parse IP networks strings into ipaddress objects.
        processed_rules = []
        for rule in rules:
            try:
                # Assuming rule has source_ip, destination_ip, service, action
                # We need to handle 'any', 'host X', 'X.X.X.X/M', object-groups?
                # This is complex. For MVP, let's assume simple CIDR or 'any'.
                # Real-world rules reference objects. We might need to resolve objects first.
                # If objects are not resolved, we can't match.
                # The 'objects' list passed in argument is intended for resolution.
                # However, implementing full object resolution is heavy.
                # Strategy: 
                # If rule.source contains a raw IP/CIDR, use it.
                # If rule.source is 'any', match all.
                # If rule.source is an object name, ideally lookup. But for now, maybe skip complex object matching?
                # Wait, the user provided 'show access-list' which has EXPANDED lines!
                # "access-list OUTSIDE-IN line 1 extended deny object-group TCPUDP ..."
                # AND "access-list OUTSIDE-IN line 1 extended deny udp any4 ..." (expanded)
                # If we use the EXPANDED rules from the config parser, we don't need object lookup!
                # The Backend Config Parser (CiscoASA) *should* produce expanded rules if it parses 'show access-list'.
                # But our current parser parses 'show run'.
                # If 'show run' has object-groups, we need resolution.
                
                # Let's assume for this MVP we support: 'any', 'host', and CIDR. 
                # If object-group, we might miss it -> 'Unmatched'.
                
                src_net = self._parse_network(rule.source)
                dst_net = self._parse_network(rule.destination)
                svc_port = self._parse_service(rule.service) # Returns (proto, port) or None/Any

                processed_rules.append({
                    'id': rule.id,
                    'name': rule.name,
                    'action': rule.action, # permit/deny
                    'src': src_net,
                    'dst': dst_net,
                    'svc': svc_port,
                    'src_str': rule.source,
                    'dst_str': rule.destination,
                    'svc_str': rule.service,
                    'original': rule
                })
            except Exception as e:
                self.logger.warning(f"Failed to process rule {rule.id}: {e}")

        # 2. Stats Containers
        rule_stats = {r['id']: {
            'name': r['name'],
            'hits': 0, 
            'bytes': 0, 
            'last_seen': None,
            'source': r['src_str'],
            'destination': r['dst_str'],
            'service': r['svc_str'],
            'action': r['action'],
            'distinct_services': set(), # For Over-Permissive Check
            'distinct_sources': set()   # For Consolidation Check
        } for r in processed_rules}
        
        unmatched_count = 0
        denied_count = 0
        
        # Containers for advanced analysis
        denied_patterns = Counter() # (src_ip, dst_ip, proto, port)
        consolidation_candidates = defaultdict(set) # (dst_ip, proto, port) -> {src_ips}
        total_logs = len(parsed_logs)

        # 3. Iterate Logs
        for log in parsed_logs:
            # Check only Allow logs (3020xx) or Deny logs (106xxx)
            # 106023 is explicitly Denied. We can map it to "Implicit Deny" or Explicit Deny rule.
            # 3020xx is Allowed. We need to find the Permit rule.

            if log['action'] == 'deny':
                denied_count += 1
                # Track deny pattern
                src = log.get('src_ip')
                dst = log.get('dst_ip')
                proto = log.get('proto', '').lower()
                port = log.get('dst_port', '0')
                if src and dst:
                    denied_patterns[(src, dst, proto, port)] += 1

                # Heuristic: Find if there's an EXPLICIT Deny rule that matches.
                # If found, increment that rule's hit count.
                matched_rule = self._find_match(log, processed_rules)
                if matched_rule:
                    self._update_stats(rule_stats, matched_rule['id'], log)
                continue

            if log['action'] == 'allow':
                # Find the first PERMIT rule that matches
                matched_rule = self._find_match(log, processed_rules)
                if matched_rule:
                    if matched_rule['action'] == 'permit':
                        self._update_stats(rule_stats, matched_rule['id'], log)
                    else:
                        # Log says ALLOW, but Rule says DENY?
                        # This happens if there is a 'permit' rule ABOVE the 'deny' rule we found?
                        # Or if we found a Deny rule but the traffic was allowed?
                        # Logic error in simulation or incomplete rulebase.
                        unmatched_count += 1
                else:
                    unmatched_count += 1

        # 4. Generate Recommendations
        recommendations = self._generate_recommendations(rule_stats, denied_patterns, consolidation_candidates)

        # Clean up sets for JSON serialization
        for r_id in rule_stats:
            rule_stats[r_id]['distinct_services'] = list(rule_stats[r_id]['distinct_services'])
            rule_stats[r_id]['distinct_sources'] = list(rule_stats[r_id]['distinct_sources'])

        return {
            "total_logs": total_logs,
            "denied_logs": denied_count,
            "unmatched_logs": unmatched_count,
            "rule_stats": rule_stats,
            "recommendations": recommendations,
        }

    def _generate_recommendations(self, rule_stats, denied_patterns, consolidation_candidates):
        recs = []
        
        # A. Over-Permissive Rules (Any Cleanup)
        for r_id, stats in rule_stats.items():
            # Check if rule allows 'any' source or destination
            is_any_src = 'any' in stats['source'].lower()
            is_any_dst = 'any' in stats['destination'].lower()
            
            if (is_any_src or is_any_dst) and stats['action'] == 'permit' and stats['hits'] > 0:
                services = stats['distinct_services'] # List of (proto, port) strings "tcp/80"
                if len(services) > 0 and len(services) <= 5: # Relaxed: up to 5 ports used
                    services_str = ", ".join(services)
                    
                    # Generate CLI
                    cli = []
                    for s in services:
                        proto, port = self._parse_service(s)
                        cli.append(f"access-list {stats['name']} line 1 extended permit {proto} {stats['source']} {stats['destination']} eq {port}")
                    cli.append(f"no access-list {stats['name']} extended permit {stats['action']} {stats['source']} {stats['destination']} # Remove original")
                    
                    recs.append({
                        "type": "over_permissive",
                        "severity": "high",
                        "rule_id": r_id,
                        "rule_name": stats['name'],
                        "description": f"Rule allows wide access ('any') but only sees traffic on specific ports: {services_str}.",
                        "suggestion": f"Split into specific rules for {services_str} and remove the broad 'any' rule.",
                        "cli_commands": cli
                    })

                # A.2 Tighten Scope (Source/Dest Cleanup)
                # If rule is 'any' src but only hit by a few specific IPs
                sources = list(stats['distinct_sources'])
                if is_any_src and len(sources) > 0 and len(sources) <= 10:
                    sources_str = ", ".join(sources[:5]) + (f" and {len(sources)-5} more" if len(sources) > 5 else "")
                    
                    # Generate CLI
                    grp_name = f"OG_TIGHTEN_{str(r_id)[:8]}"
                    cli = [f"object-group network {grp_name}"]
                    for s in sources:
                        cli.append(f" network-object host {s}")
                    cli.append(f"exit")
                    cli.append(f"access-list {stats['name']} line 1 extended permit ip object-group {grp_name} {stats['destination']}")
                    cli.append(f"# Ideally place this ABOVE the original broad rule")

                    recs.append({
                        "type": "tighten_scope",
                        "severity": "medium",
                        "rule_id": r_id,
                        "rule_name": stats['name'],
                        "description": f"Rule Source is 'any' but traffic only comes from {len(sources)} specific IPs: {sources_str}.",
                        "suggestion": "Replace 'any' with a Group Object containing these specific IPs to tighten security.",
                        "cli_commands": cli
                    })

        # B. Frequent Deny Patterns (New Rule Suggestion)
        # Threshold: e.g., > 10 hits or > 1% of total denies? Let's use > 5 hits for now (demo friendly)
        for (src, dst, proto, port), count in denied_patterns.most_common(5):
            if count > 5:
                # Guess ACL name (e.g. typical outside/inside) or generic
                acl_name = "OUTSIDE-IN" 
                
                cli = [f"access-list {acl_name} line 1 extended permit {proto} host {src} host {dst} eq {port}"]
                
                recs.append({
                    "type": "frequent_deny",
                    "severity": "medium",
                    "rule_id": None,
                    "rule_name": "Potential New Rule",
                    "description": f"Frequent denied traffic (Count: {count}) from {src} to {dst} on {proto}/{port}.",
                    "suggestion": "Verify if this traffic is legitimate. If so, create a new rule to allow it.",
                    "cli_commands": cli
                })

        # C. Rule Consolidation (Subnet Grouping)
        # Check consolidation candidates: > 10 distinct sources for same destination hitting ANY rule or pattern
        # Actually this structure was built from ALLOW traffic? 
        # ... (rest unchanged) 
        # Wait, I didn't populate consolidation_candidates in loop yet.
        # I need to populate it inside the loop.
        # Assuming I updated _update_stats to populate 'distinct_sources' on the RULE.
        # I can scan rules for consolidation opportunities.
        
        for r_id, stats in rule_stats.items():
            sources = stats['distinct_sources'] # List of IP strings
            if len(sources) >= 3: # Relaxed: Threshold for consolidation
                # Check if they belong to same /24
                subnets = defaultdict(int)
                for src in sources:
                    try:
                        ip = ipaddress.ip_address(src)
                        # primitive /24 check
                        if isinstance(ip, ipaddress.IPv4Address):
                            net = ipaddress.IPv4Network(f"{src}/24", strict=False)
                            subnets[str(net)] += 1
                    except:
                        pass
                
                for subnet, count in subnets.items():
                    if count >= 3: # Relaxed: If 3+ IPs from same subnet
                        
                        # Generate CLI
                        # subnet: "10.20.22.0/24"
                        grp_name = f"OG_NET_{subnet.replace('.', '_').replace('/', '_')}"
                        cli = [
                            f"object-group network {grp_name}",
                            f" network-object {subnet.split('/')[0]} {ipaddress.IPv4Network(subnet).netmask}",
                            f"exit",
                            f"access-list {stats['name']} line 1 extended permit ip object-group {grp_name} {stats['destination']}",
                            f"# Ideally place this ABOVE the original broad rule"
                        ]

                        recs.append({
                            "type": "consolidation",
                            "severity": "low",
                            "rule_id": r_id,
                            "rule_name": stats['name'],
                            "description": f"Rule is hit by {count} distinct IPs from the same subnet {subnet}.",
                            "suggestion": f"Create a Network Object for {subnet} and use it in the rule source to simplify management.",
                            "cli_commands": cli
                        })
                        
        return recs

    def _parse_network(self, net_str: str):
        if not net_str or net_str.lower() == 'any' or net_str.lower() == 'any4':
            return ipaddress.ip_network('0.0.0.0/0')
        if 'host' in net_str.lower():
            # 'host 1.2.3.4'
            parts = net_str.split()
            if len(parts) >= 2: 
                return ipaddress.ip_network(f"{parts[1]}/32")
        try:
            return ipaddress.ip_network(net_str, strict=False)
        except:
            return None # Failed to parse

    def _parse_service(self, svc_str: str):
        # 'tcp/80', 'udp/53', 'ip', 'icmp'
        # Return ('proto', port_int)
        # If 'ip' -> ('ip', 0) (Any proto)
        if not svc_str or svc_str.lower() == 'ip':
            return ('any', 0)
        
        # Simple parsing logic
        if '/' in svc_str:
            proto, port = svc_str.split('/')
            return (proto.lower(), int(port) if port.isdigit() else 0)
        
        return (svc_str.lower(), 0)

    def _find_match(self, log, rules):
        # log: src_ip, dst_ip, proto, dst_port (if available)
        # We need to construct a "packet" from log
        try:
            src_ip_obj = ipaddress.ip_address(log.get('src_ip')) if log.get('src_ip') else None
            dst_ip_obj = ipaddress.ip_address(log.get('dst_ip')) if log.get('dst_ip') else None
        except:
            return None # Invalid IP in log

        if not src_ip_obj or not dst_ip_obj:
            return None

        log_proto = log.get('proto', '').lower()
        log_port = int(log.get('dst_port')) if log.get('dst_port') and log.get('dst_port').isdigit() else 0

        for rule in rules:
            # check src
            if rule['src'] and src_ip_obj not in rule['src']:
                continue
            # check dst
            if rule['dst'] and dst_ip_obj not in rule['dst']:
                continue
            # check service
            # rule['svc'] = (proto, port). (any, 0) matches all.
            r_proto, r_port = rule['svc']
            if r_proto != 'any' and r_proto != 'ip':
                if r_proto != log_proto:
                    continue
                # If proto matches, check port (if rule specifies port)
                if r_port != 0 and r_port != log_port:
                    continue
            
            return rule # First match wins
        
        return None

    def _update_stats(self, stats, rule_id, log):
        if rule_id in stats:
            stats[rule_id]['hits'] += 1
            stats[rule_id]['bytes'] += log.get('bytes', 0)
            stats[rule_id]['last_seen'] = log.get('timestamp')
            
            # Track Distinct Services (proto/port) used
            proto = log.get('proto', 'any')
            port = log.get('dst_port', '0')
            svc_key = f"{proto}/{port}"
            stats[rule_id]['distinct_services'].add(svc_key)
            
            # Track Distinct Sources used
            src = log.get('src_ip')
            if src:
                stats[rule_id]['distinct_sources'].add(src)

traffic_analyzer = TrafficAnalyzerService()
