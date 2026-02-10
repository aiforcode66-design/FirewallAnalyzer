from typing import List, Dict, Any
import ipaddress
from app.models.rule import FirewallRule

class ShadowDetectorService:
    @staticmethod
    def _is_network_subset(sub: str, super: str) -> bool:
        """
        Check if 'sub' network/IP is a subset of 'super' network/IP.
        Enhanced to use ipaddress module for full CIDR support.
        """
        import ipaddress

        sub = sub.lower().strip()
        super = super.lower().strip()
        
        # 1. Handle Keywords
        if super == 'any' or super == '0.0.0.0/0':
            return True
        if sub == 'any' or sub == '0.0.0.0/0':
             # Any cannot be subset of specific unless super is also any (handled above)
            return False 

        # 2. Try parsing as IP Networks
        try:
            # Helper to normalize IP strings
            def get_net(val):
                if '/' not in val:
                    return ipaddress.ip_network(f"{val}/32")
                return ipaddress.ip_network(val, strict=False)

            sub_net = get_net(sub)
            super_net = get_net(super)
            
            return sub_net.subnet_of(super_net)
            
        except ValueError:
            # If parsing fails (e.g. object names 'DMZ-Net', 'Host-A'), fall back to string match
            return sub == super

    @staticmethod
    def detect_shadowed_rules(rules: List[FirewallRule]) -> List[Dict[str, Any]]:
        """
        Detect rules that are shadowed by previous rules.
        
        Definition (aligned with AnalysisEngine):
        - SHADOWED: Rule is covered by prior rule with DIFFERENT action (will never execute, conflicting intent)
        - REDUNDANT: Rule is covered by prior rule with SAME action (duplicate coverage, not returned here)
        
        Returns a list of "Shadow Issues" - only true shadowing cases.
        """
        shadowed_issues = []
        
        # Sort by sequence (ACL line order) first, fallback to created_at if sequence is null
        sorted_rules = sorted(rules, key=lambda x: (x.sequence if x.sequence is not None else float('inf'), x.created_at))
        
        for i, rule_current in enumerate(sorted_rules):
            # Compare with all previous rules (j < i)
            for j in range(i):
                rule_prev = sorted_rules[j]
                
                # Check 0: Same ACL Context
                # Shadowing only happens within the same Access-List
                if rule_prev.name != rule_current.name:
                    continue
                
                # Check 1: Scope Coverage
                src_shadowed = ShadowDetectorService._is_network_subset(rule_current.source, rule_prev.source)
                dst_shadowed = ShadowDetectorService._is_network_subset(rule_current.destination, rule_prev.destination)
                svc_shadowed = ShadowDetectorService._is_network_subset(rule_current.service, rule_prev.service)
                
                if src_shadowed and dst_shadowed and svc_shadowed:
                    # Check 2: Action difference (CRITICAL for true shadowing)
                    # Only count as SHADOWED if actions differ
                    prev_action = rule_prev.action.lower()
                    curr_action = rule_current.action.lower()
                    
                    # Normalize actions for comparison
                    def normalize_action(a):
                        if a in ['allow', 'permit']:
                            return 'permit'
                        return 'deny'
                    
                    if normalize_action(prev_action) != normalize_action(curr_action):
                        # TRUE SHADOWING - different actions
                        issue = {
                            "shadowed_rule": {
                                "id": str(rule_current.id),
                                "name": rule_current.name,
                                "line_number": i + 1,
                                "action": rule_current.action,
                                "source": rule_current.source,
                                "destination": rule_current.destination,
                                "service": rule_current.service
                            },
                            "shadowing_rule": {
                                "id": str(rule_prev.id),
                                "name": rule_prev.name,
                                "line_number": j + 1,
                                "action": rule_prev.action,
                                "source": rule_prev.source,
                                "destination": rule_prev.destination,
                                "service": rule_prev.service
                            },
                            "reason": "Action Conflict - rule will never execute"
                        }
                        shadowed_issues.append(issue)
                    # If same action, it's REDUNDANT - we don't add it here (handled by MergerService)
                    
                    break  # Found the first rule that shadows/covers it
                    
        return shadowed_issues

