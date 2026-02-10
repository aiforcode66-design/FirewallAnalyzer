"""Firewall Configuration Parse Service."""
import re

class ConfigParser:
    @staticmethod
    def parse(vendor_name: str, content: str):
        """Parse configuration logic returning stats."""
        # This method is for quick stats
        rules = ConfigParser.parse_rules(vendor_name, content)
        return {
            "rules_count": len(rules),
            "rules_data": rules
        }

    @staticmethod
    def extract_objects(vendor_name: str, content: str):
        """Extract objects from configuration."""
        vendor = vendor_name.lower().replace(" ", "")
        if "cisco" in vendor:
            return ConfigParser._extract_objects_cisco(content)
        return {"objects": [], "groups": []}

    @staticmethod
    def parse_rules(vendor_name: str, content: str):
        """Parse content into structured rule objects."""
        vendor = vendor_name.lower().replace(" ", "")
        
        if "cisco" in vendor:
            return ConfigParser._parse_cisco_rules(content)
        # Add others as needed
        return []

    @staticmethod
    def _parse_cisco_rules(content: str):
        """Parse Cisco ASA/IOS config into structured dicts (supporting hierarchy)."""
        lines = content.splitlines()
        structured_rules = []
        current_parent = None
        sequence_counter = 0  # Track sequence for ordering
        
        for line_raw in lines:
            # Detect indentation for hierarchy
            # If line starts with space/tab, it is likely a child of the previous rule (e.g. expanded object-group)
            is_indented = line_raw.startswith(' ') or line_raw.startswith('\t')
            line = line_raw.strip()
            lower_line = line.lower()
            
            # Basic validation
            if not ('access-list' in lower_line and ('permit' in lower_line or 'deny' in lower_line)):
                 continue

            # Skip remarks explicitly
            if ' remark ' in lower_line or lower_line.endswith(' remark'):
                 continue
            
            # Extract ACL line number if present (e.g., "access-list OUTSIDE line 10 extended permit...")
            acl_line_number = None
            line_match = re.search(r'\bline\s+(\d+)\b', line, re.IGNORECASE)
            if line_match:
                acl_line_number = int(line_match.group(1))
                 
            try:
                parts = line.split()
                
                # Finding 'permit' or 'deny' index to anchor
                action_idx = -1
                if 'permit' in parts:
                    action_idx = parts.index('permit')
                elif 'deny' in parts:
                    action_idx = parts.index('deny')
                
                if action_idx == -1: continue
                
                action = parts[action_idx]
                
                # Protocol is usually valid after action
                if action_idx + 1 >= len(parts): continue
                protocol = parts[action_idx + 1]
                
                # Name is usually the part before 'extended' or the second word
                name = "Unknown"
                if parts[0].lower() == 'access-list':
                     name = parts[1]
                
                idx = action_idx + 2
                
                # Handle object-group as protocol (e.g. object-group TCPUDP)
                if protocol.lower() == 'object-group' and len(parts) > idx:
                    protocol = f"object-group {parts[idx]}"
                    idx += 1
                
                # Parse Source
                src, idx = ConfigParser._extract_ip(parts, idx)
                if src == "Missing":
                    src = "any"
                
                # Handle potential Source Port Operator
                src_port = None
                if idx < len(parts) and parts[idx] in ["eq", "lt", "gt", "neq", "range"]:
                    op = parts[idx]
                    val = parts[idx+1]
                    idx += 2
                    if op == "range":
                         val += f"-{parts[idx]}" 
                         idx += 1
                    src_port = f"{op} {val}"
                
                # Parse Destination
                dst, idx = ConfigParser._extract_ip(parts, idx)
                if dst == "Missing":
                    dst = "any"
                
                # Parse Destination Port (Service)
                service = protocol
                
                if idx < len(parts):
                    if parts[idx] in ["eq", "lt", "gt", "neq", "range"]:
                         op = parts[idx]
                         val = parts[idx+1]
                         if op == "range" and idx+2 < len(parts):
                              val += f"-{parts[idx+2]}"
                         
                         service = f"{protocol}/{val}" if op == "eq" else f"{protocol}/{op}-{val}"
                    elif parts[idx] == "object-group":
                         if idx + 1 < len(parts):
                             service = f"object-group {parts[idx+1]}"
                
                if src_port and service == protocol:
                    service = f"{protocol} (src: {src_port})"
                
                hits = ConfigParser._extract_hits(line)
                rule_hash = ConfigParser._extract_hash(line)
                last_hit = ConfigParser._extract_last_hit(line) # Add last_hit extraction
                
                # Determine sequence: use GLOBAL sequence counter 
                # Note: ACL "line N" is per-ACL (each ACL starts at line 1), not global
                if not is_indented:
                    sequence_counter += 1
                current_sequence = sequence_counter
                
                rule_obj = {
                    "name": name,
                    "action": action,
                    "source": src,
                    "destination": dst,
                    "service": service,
                    "raw": line_raw,
                    "hash": rule_hash,
                    "hits": hits,
                    "last_hit": last_hit,
                    "sequence": current_sequence,  # Add sequence to rule
                    "children": [] 
                }
                
                if is_indented and current_parent:
                    # It's a child rule - inherit parent's sequence
                    rule_obj["sequence"] = current_parent.get("sequence")
                    current_parent["children"].append(rule_obj)
                else:
                    # It's a new parent/top-level rule
                    structured_rules.append(rule_obj)
                    current_parent = rule_obj
                    
            except Exception:
                continue
                
        return structured_rules

    @staticmethod
    def _extract_hash(line: str):
        """Extract hash 0x... from end of line."""
        match = re.search(r'0x([0-9a-fA-F]+)\s*$', line)
        if match:
            return match.group(1)
        return None

    @staticmethod
    def _extract_hits(line: str):
        """Extract hitcnt=N from line."""
        match = re.search(r'hitcnt=(\d+)', line)
        if match:
            return int(match.group(1))
        return 0

    @staticmethod
    def _extract_last_hit(line: str):
        """
        Extract last-hit timestamp if available. 
        Format variations: 
        - (last-hit 2023-10-20 10:00:00)
        - (last-hit <timestamp>)
        """
        try:
            # Look for (last-hit ...) pattern
            # Capture content inside the parens after 'last-hit ' using non-greedy match
            match = re.search(r'\(last-hit\s+([^)]+)\)', line, re.IGNORECASE)
            if match:
                timestr = match.group(1).strip()
                # Try parsing common formats
                # 1. ISO-ish: 2026-02-02 12:00:00
                from datetime import datetime
                try:
                    # Generic parse attempt (assuming YYYY-MM-DD HH:MM:SS)
                    # Modify format as per actual device sample if available. 
                    # Generally ASA uses: HH:MM:SS Month Day Year (e.g. 11:22:33 Oct 20 2023) 
                    # or standard ISO check.
                    # Let's try flexible parsing or dateutil if installed? 
                    # Since we don't have dateutil in stdlib, stick to common formats.
                    
                    # Try YYYY-MM-DD HH:MM:SS
                    return datetime.strptime(timestr, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        # Try "14:15:16 Feb 06 2026" (common legacy Cisco)
                        # Format: %H:%M:%S %b %d %Y
                        return datetime.strptime(timestr, "%H:%M:%S %b %d %Y")
                    except ValueError:
                        pass
                        
                # If we extracted it but failed to parse, maybe return None or log?
                # For now returning None to be safe.
                pass
        except:
            pass
        return None

    @staticmethod
    def _extract_objects_cisco(content: str):
        """Parse Cisco Object definitions."""
        lines = content.splitlines()
        
        extracted_objects = []
        extracted_groups = []
        
        obj_net_pattern = re.compile(r'^\s*object\s+network\s+(\S+)', re.IGNORECASE)
        obj_svc_pattern = re.compile(r'^\s*object\s+service\s+(\S+)', re.IGNORECASE)
        obj_group_pattern = re.compile(r'^\s*object-group\s+(\S+)\s+(\S+)', re.IGNORECASE)
        
        current_obj = None
        current_group = None
        
        for line in lines:
            line_val = line.strip()
            if not line_val: continue
            
            # Detect Start
            net_match = obj_net_pattern.match(line)
            svc_match = obj_svc_pattern.match(line)
            group_match = obj_group_pattern.match(line)
            
            if net_match or svc_match or group_match:
                # Save previous
                if current_obj:
                    extracted_objects.append(current_obj)
                    current_obj = None
                if current_group:
                    extracted_groups.append(current_group)
                    current_group = None
            
            if net_match:
                current_obj = {"name": net_match.group(1), "type": "network", "value": "unknown", "description": ""}
                continue
            
            if svc_match:
                current_obj = {"name": svc_match.group(1), "type": "service", "value": "unknown", "description": ""}
                continue
            
            if group_match:
                g_type = group_match.group(1).lower()
                g_name = group_match.group(2)
                current_group = {"name": g_name, "type": g_type, "members": [], "description": ""}
                continue

            # Process Content
            if current_obj:
                low = line_val.lower()
                if low.startswith("host "):
                    current_obj["value"] = line_val.split()[1]
                    current_obj["type"] = "host"
                elif low.startswith("subnet "):
                    parts = line_val.split()
                    if len(parts) >= 3:
                        current_obj["value"] = f"{parts[1]}/{parts[2]}"
                        current_obj["type"] = "network"
                elif low.startswith("range "):
                    # range 10.10.10.1 10.10.10.2
                    current_obj["value"] = line_val.replace("range ", "")
                    current_obj["type"] = "range"
                elif low.startswith("service "):
                    # service tcp ...
                    current_obj["value"] = line_val.replace("service ", "").strip()
                elif low.startswith("description "):
                    current_obj["description"] = line_val.replace("description ", "").strip()
                elif line_val.startswith("!") or low.startswith("access-list"):
                     extracted_objects.append(current_obj)
                     current_obj = None

            elif current_group:
                low = line_val.lower()
                if low.startswith("network-object") or low.startswith("service-object") or low.startswith("group-object") or low.startswith("port-object"):
                    # Extract the member name/value
                    # network-object host 1.1.1.1 -> we might not resolve ad-hoc values yet, just store line
                    # network-object object NAME -> store NAME
                    # group-object NAME -> store NAME
                    current_group["members"].append(line_val)
                elif low.startswith("description "):
                    current_group["description"] = line_val.replace("description ", "").strip()
                elif line_val.startswith("!") or low.startswith("access-list"):
                     extracted_groups.append(current_group)
                     current_group = None

        # Clean up last
        if current_obj: extracted_objects.append(current_obj)
        if current_group: extracted_groups.append(current_group)
            
        return {"objects": extracted_objects, "groups": extracted_groups}

    @staticmethod
    def _extract_ip(parts, idx):
        """Helper to extract IP/Network from parts at idx."""
        if idx >= len(parts):
            return "any", idx
            
        token = parts[idx]
        
        # Safeguard: If we hit a port operator, we likely missed the IP (or it was implicit?)
        # For Cisco Extended ACLs, IP is mandatory. If we see 'eq', something is wrong.
        # But we shouldn't consume it as an IP.
        if token.lower() in ["eq", "lt", "gt", "neq", "range", "log", "time-range"]:
             # Return "Unknown" or handle gracefully without consuming?
             # If we consume it, next parser steps will fail.
             # Let's return a placeholder and NOT advance idx? 
             # No, if we don't advance, we infinite loop.
             # Return "Missing" and do not advance? The caller loop will have to handle.
             # But the caller expects (src, next_idx).
             return "Missing", idx

        if token.lower() == 'any' or token.lower() == 'any4' or token.lower() == 'any6':
            return "any", idx + 1
            
        elif token.lower() == 'host':
            if idx + 1 < len(parts):
                return parts[idx+1], idx + 2
            return "host-incomplete", idx + 1
            
        elif token.lower() in ['object', 'object-group']:
            # Handle "object NAME" or "object-group NAME"
            if idx + 1 < len(parts):
                return f"{token} {parts[idx+1]}", idx + 2
            return f"{token}-incomplete", idx + 1
            
        else:
            # Assume IP Mask pair (e.g. 192.168.1.0 255.255.255.0)
            # Or just IP/CIDR or ObjectName (without keyword)
            
            # Check for mask if next simple token looks like an IP/Mask
            if idx + 1 < len(parts):
                next_token = parts[idx+1]
                # improved regex for IP-like string
                if re.match(r'^\d+\.\d+\.\d+\.\d+$', next_token):
                     return f"{token}/{next_token}", idx + 2
            
            # Clean up internal IDs often found in 'show access-list' (e.g., any4(2147549184))
            # Regex to match 'any4(digits)' or similar patterns and keep only the 'any4'
            # Or simplified: if it ends with (digits), strip it.
            cleanup_match = re.match(r'^([a-zA-Z0-9\-\.]+)\(\d+\)$', token)
            if cleanup_match:
                return cleanup_match.group(1), idx + 1

            return token, idx + 1
