"""Analysis Engine Service."""

class AnalysisEngine:
    @staticmethod
    def analyze(rules):
        """Analyze a list of structured rules."""
        findings = []
        stats = {
            "totalRules": len(rules), 
            "unusedRules": 0, # Requires log data
            "redundantRules": 0, 
            "shadowedRules": 0, 
            "highRiskRules": 0, 
            "score": 100
        }

        for i, rule in enumerate(rules):
            # Normalize fields for comparison
            r_source = rule['source'].lower()
            r_dest = rule['destination'].lower()
            r_action = rule['action'].lower()
            
            # 1. Critical Analysis Rules
            # 1a. Any-Any (Critical)
            if r_source == 'any' and r_dest == 'any' and r_action in ['allow', 'permit']:
                findings.append({
                    "type": "high-risk",
                    "severity": "critical",
                    "message": f"CRITICAL: 'Any-Any' Allow rule detected: {rule['raw'][:50]}...",
                    "recommendation": "Restrict source and destination immediately. This allows open access.",
                    "rule_id": rule.get("id")
                })
                stats["highRiskRules"] += 1
                stats["score"] -= 10
            
            # 1b. Destination Any (High) - Exclude if source is specific (e.g. outbound internet) to reduce noise, but request asked for "destination any"
            elif r_dest == 'any' and r_action in ['allow', 'permit']:
                 findings.append({
                    "type": "high-risk",
                    "severity": "high",
                    "message": f"High Risk: Destination 'any' allowed: {rule['raw'][:50]}...",
                    "recommendation": "Scope destination to specific networks if possible.",
                    "rule_id": rule.get("id")
                })
                 stats["highRiskRules"] += 1
                 stats["score"] -= 5

            # 1c. Source Any (Medium) - Common for public services, but worth reviewing
            elif r_source == 'any' and r_action in ['allow', 'permit']:
                 findings.append({
                    "type": "risk",
                    "severity": "medium",
                    "message": f"Medium Risk: Source 'any' allowed: {rule['raw'][:50]}...",
                    "recommendation": "Verify if this service needs to be globally accessible.",
                    "rule_id": rule.get("id")
                })
                 stats["score"] -= 2

            # 1d. Supernet Check
            for field in ['source', 'destination']:
                val = rule.get(field, '')
                # Ignore 'any' for supernet check as it's caught by specific checks above
                if val == 'any' or val == '0.0.0.0/0': 
                    continue
                    
                if '/' in val:
                    try:
                        cidr = int(val.split('/')[1])
                        if cidr < 24 and val != '0.0.0.0/0':
                             findings.append({
                                "type": "supernet",
                                "severity": "medium",
                                "message": f"Broad Network Access ({val}) in {field}",
                                "recommendation": "Ensure broad network ranges are intended.",
                                "rule_id": rule.get("id")
                            })
                    except:
                        pass

            # 1e. Unused Rule Check (Enhanced)
            # Logic: If hits == 0 OR (last_hit exists and older than threshold)
            hits = rule.get('hits', 0)
            last_hit = rule.get('last_hit')
            is_unused = False
            unused_reason = ""

            if hits == 0:
                is_unused = True
                unused_reason = "Zero hits recorded"
            elif last_hit:
                # Check age
                from datetime import datetime
                # Handle simplified string format if it comes from dict, or datetime if from strict parser
                # Parser returns datetime object.
                if isinstance(last_hit, datetime):
                    days_diff = (datetime.utcnow() - last_hit).days
                    if days_diff > 90: # Default threshold, could be parametrized
                        is_unused = True
                        unused_reason = f"Inactive for {days_diff} days"

            if is_unused:
                 findings.append({
                    "type": "unused",
                    "severity": "medium", 
                    "message": f"Unused Rule: {unused_reason} for '{rule['raw'][:50]}...'",
                    "recommendation": "Consider removing or disabling this rule.",
                    "rule_id": rule.get("id")
                })
                 stats["unusedRules"] += 1
                 stats["score"] -= 1

            # 2. Shadow/Redundancy Check
            # Check against all PREVIOUS rules
            for j in range(0, i):
                prior = rules[j]
                
                # Check 0: Same ACL Context
                # Shadowing only happens within the same Access-List
                if prior.get('name') != rule.get('name'):
                    continue
                
                # Skip if prior rule has different service (unless generic) - simplified
                # Use strict service check for now unless we implement port logic
                if prior['service'] != rule['service'] and prior['service'] != 'ip' and rule['service'] != 'ip':
                    continue

                if AnalysisEngine._covers(prior, rule):
                    if prior['action'] == rule['action']:
                        # Redundant
                        findings.append({
                            "type": "redundant",
                            "severity": "low",
                            "message": f"Redundant rule detected. Covered by '{prior['raw'][:30]}...'",
                            "recommendation": "Remove this rule as it provides no additional access control.",
                            "rule_id": rule.get("id")
                        })
                        stats["redundantRules"] += 1
                        stats["score"] -= 2
                    else:
                        # Shadowed
                        findings.append({
                            "type": "shadowed",
                            "severity": "high",
                            "message": f"Shadowed rule detected. Blocked/Overridden by '{prior['raw'][:30]}...'",
                            "recommendation": "Reorder rules. This rule will never be hit.",
                            "rule_id": rule.get("id")
                        })
                        stats["shadowedRules"] += 1
                        stats["score"] -= 5
                    
                    # Stop checking once we find a cover (first match wins in FW)
                    break
        
        # Normalize score
        stats["score"] = max(0, min(100, stats["score"]))
        return stats, findings

    @staticmethod
    def _covers(r1, r2):
        """
        Check if r1 covers r2 (r1 is superset of r2).
        Uses ipaddress for robust network checking.
        """
        import ipaddress
        
        def to_net(val):
            val = val.strip().lower()
            if val == 'any' or val == '0.0.0.0/0':
                return ipaddress.ip_network('0.0.0.0/0')
            if '/' not in val:
                # Assume host
                try:
                    return ipaddress.ip_network(f"{val}/32")
                except:
                    return None # Fail safe for objects/names
            try:
                return ipaddress.ip_network(val, strict=False)
            except:
                return None

        # Source Check
        s1 = to_net(r1['source'])
        s2 = to_net(r2['source'])
        
        # If we can't parse IP (e.g. object names), fall back to string equality or assumption
        # Fallback: if names match, it covers. If r1 is 'any', it covers.
        if not s1 or not s2:
             src_cover = (r1['source'] == 'any' or r1['source'] == '0.0.0.0/0' or 
                          r1['source'] == r2['source'])
        else:
             src_cover = s2.subnet_of(s1) # r1 is super, r2 is sub. s2 inside s1.


        # Dest Check
        d1 = to_net(r1['destination'])
        d2 = to_net(r2['destination'])
        
        if not d1 or not d2:
             dst_cover = (r1['destination'] == 'any' or r1['destination'] == '0.0.0.0/0' or 
                          r1['destination'] == r2['destination'])
        else:
             dst_cover = d2.subnet_of(d1)
        
        # Service Check
        # If r1 is 'ip' (all protocols), it covers specific like tcp/80
        # Simple string match for MVP, or protocol hierarchy logic
        srv_cover = r1['service'] == r2['service'] or r1['service'] == 'ip' or r1['service'] == 'any'
        
        return src_cover and dst_cover and srv_cover
