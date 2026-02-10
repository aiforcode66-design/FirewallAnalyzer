"""Zip Parsing Service for Multi-Context & Advanced Analytics."""
import zipfile
import re
import os
from io import BytesIO
from typing import Dict, List, Tuple
from datetime import datetime, timezone, timedelta

class ZipParser:
    @staticmethod
    def extract_zip(content_bytes: bytes) -> Dict[str, str]:
        """Extract all text files from ZIP."""
        files = {}
        with zipfile.ZipFile(BytesIO(content_bytes), 'r') as z:
            for filename in z.namelist():
                if filename.endswith('/') or filename.startswith('__MACOSX'):
                    continue
                try:
                    with z.open(filename) as f:
                        # Try decode as utf-8, fallback to latin-1
                        raw = f.read()
                        try:
                            text = raw.decode('utf-8')
                        except UnicodeDecodeError:
                            text = raw.decode('latin-1')
                        files[filename] = text
                except Exception as e:
                    print(f"Failed to read {filename}: {e}")
        return files

    @staticmethod
    def identify_context_files(files: Dict[str, str]) -> Dict[str, Dict[str, str]]:
        """
        Group files by Context Name.
        """
        contexts = {}
        pending_files = [] # (filename, content)
        
        # Pass 1: Identify explicit contexts and multi-context files
        for filename, content in files.items():
            # Check for multi-context delimiters (e.g. show tech)
            pattern = r'hostname\s+([^\s]+)\s*\n(.*?)\n\s*:\s*end'
            matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)
            
            if matches:
                 print(f"File {filename}: Found {len(matches)} contexts via delimiters.")
                 
                 # Find global timestamp to propagate
                 timestamp_header = ""
                 
                 # Helper to try finding timestamp in the whole content (header area)
                 # We look at the first 4000 chars to avoid scanning huge files unnecessarily
                 header_content = content[:4000]
                 found_ts_dt = ZipParser.extract_backup_timestamp(header_content)
                 
                 if found_ts_dt:
                     # Convert back to string for the header comment (or just ISO format)
                     timestamp_header = f"! Global Timestamp: {found_ts_dt.isoformat()}\n"
                 
                 for hostname, ctx_content in matches:
                     hostname = hostname.strip()
                     if hostname not in contexts:
                         contexts[hostname] = {"config": "", "brief": "", "detailed": ""}
                     
                     # Prepend timestamp if found
                     final_content = timestamp_header + ctx_content
                     
                     match_brief = ("elements; name hash:" in final_content or re.search(r'[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}', final_content))
                     
                     if match_brief:
                         contexts[hostname]["brief"] = final_content
                     else:
                         contexts[hostname]["config"] += final_content + "\n"
                 continue 

            # Check for explicit hostname in file content
            hostname = ZipParser._extract_hostname(content)
            if hostname:
                if hostname not in contexts:
                    contexts[hostname] = {"config": "", "brief": "", "detailed": ""}
                
                # Assign content
                # Assign content
                match_brief = ("access-list" in content and ("elements; name hash:" in content or re.search(r'[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}', content)))
                match_detailed = ("hitcnt=" in content)
                match_config = ("access-list" in content and "extended permit" in content)
                
                # Priority 1: Detailed (Explicit hits)
                if match_detailed:
                     contexts[hostname]["detailed"] = content
                # Priority 2: Config (Explicit rules)
                elif match_config:
                     # Check if it's better than what we have
                     if len(content) > len(contexts[hostname]["config"]):
                         contexts[hostname]["config"] = content
                # Priority 3: Brief (Timestamps by Hex)
                elif match_brief:
                     contexts[hostname]["brief"] = content
            else:
                # No hostname found, check if filename matches any known context
                matched_context = None
                for ctx_name in contexts:
                    if ctx_name.lower() in filename.lower():
                        matched_context = ctx_name
                        break
                
                if matched_context:
                      match_brief = ("elements; name hash:" in content or re.search(r'[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}', content))
                      match_detailed = ("hitcnt=" in content)
                      match_config = ("access-list" in content and "extended permit" in content)

                      if match_detailed:
                          contexts[matched_context]["detailed"] += "\n" + content
                      elif match_config:
                           contexts[matched_context]["config"] += "\n" + content
                      elif match_brief:
                          contexts[matched_context]["brief"] += "\n" + content
                else:
                    pending_files.append((filename, content))

        # Pass 2: Distribute pending files to matching contexts (or all if no match)
        for filename, content in pending_files:
             is_detailed = "hitcnt=" in content
             is_brief = "elements; name hash:" in content or re.search(r'[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}\s+[0-9a-fA-F]{8}', content)
             
             if not (is_detailed or is_brief):
                 continue

             # Extract potential ACL names from the file content
             # Patterns: 
             # Brief: access-list NAME; 
             # Detailed: access-list NAME line ...
             # We just look for 'access-list NAME' generally
             found_acls = set(re.findall(r'access-list\s+([^\s;]+)', content))
             
             matched_targets = []
             
             # Try to find which contexts actually USE these ACLs
             for ctx_name, ctx_data in contexts.items():
                 config_text = ctx_data.get("config", "")
                 
                 # Check if any found ACL is present in this context's config
                 # We look for explicit definition or usage: 'access-list NAME'
                 for acl in found_acls:
                     if f"access-list {acl}" in config_text:
                         matched_targets.append(ctx_name)
                         break
             
             # Fallback: If no context explicitly owns these ACLs, distribute to ALL (legacy safe-guard)
             # But if AT LEAST ONE context matched, we assume it's specific to those.
             targets = matched_targets if matched_targets else list(contexts.keys())
             
             for ctx_name in targets:
                 if is_detailed:
                     contexts[ctx_name]["detailed"] += "\n" + content
                 elif is_brief:
                     contexts[ctx_name]["brief"] += "\n" + content
        
        return contexts
        
        return contexts
    
    @staticmethod
    def _extract_hostname(content: str) -> str:
        """Find hostname in config."""
        match = re.search(r'^hostname\s+(\S+)', content, re.MULTILINE)
        if match:
            return match.group(1).strip()
        # Fallback for show tech
        match = re.search(r'Network Name\.\.\.\s+:\s+(\S+)', content)
        if match:
            return match.group(1).strip()
        return None

    @staticmethod
    def parse_access_list_brief(content: str) -> Dict[str, int]:
        """
        Parse 'show access-list brief' to map Hash -> Timestamp.
        Returns: { "0x123abc": 1675681234 }
        """
        # Format:
        # access-list TRUST; 24 elements; name hash: 0x106592f8
        # bfa73683 00000000 000b6f9f 6091c5b8
        # HASH     HITS(Hex) ?        TIMESTAMP(Hex)
        
        hash_map = {}
        lines = content.splitlines()
        
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 4 and len(parts[0]) == 8: # Basic validation for hash line
                rule_hash = parts[0]
                timestamp_hex = parts[3]
                try:
                    # Parse timestamp (e.g. 6091c5b8 -> 1620166072)
                    ts = int(timestamp_hex, 16)
                    # Filter invalid dates (e.g. before 2000 or future) if needed
                    hash_map[rule_hash] = ts
                except ValueError:
                    continue
        return hash_map

    @staticmethod
    def extract_rule_hashes(content: str) -> Dict[str, str]:
        """
        Parse 'show access-list' (detailed) to map Rule String -> Hash.
        This is tricky because show access-list output format:
        access-list TRUST line 2 extended permit ... (hitcnt=123) 0xbfa73683
        """
        # We need to link the Rule Object we created (standardized) to this Hash.
        # But 'parser.py' creates standardized objects without the raw line hash.
        
        # Alternative Strategy:
        # We return a map of { RawLineHash: HitCount }
        # And we let the Manager try to fuzzy match or we store the Hash in DB.
        pass

    @staticmethod
    def parse_detailed_hits(content: str) -> Dict[str, dict]:
        """
        Parse 'show access-list' detailed output.
        Returns: { 
           "0xbfa73683": { "hits": 749471, "raw": "..." } 
        }
        """
        hits_map = {}
        # Regex to capture Hash at end of line: 0x([0-9a-f]+)$
        # Regex to capture hitcnt=(\d+)
        
        lines = content.splitlines()
        for line in lines:
            line = line.strip()
            if not line.startswith("access-list"): continue
            
            # Extract Hash
            # Relaxed regex: 0x followed by hex chars, optional whitespace at end
            hash_match = re.search(r'0x([0-9a-fA-F]+)\s*$', line)
            if not hash_match: continue
            rule_hash = hash_match.group(1)
            
            # Extract Hits
            hits_match = re.search(r'hitcnt=(\d+)', line)
            hits = int(hits_match.group(1)) if hits_match else 0
            
            hits_map[rule_hash] = {
                "hits": hits,
                "raw": line
            }
        
        return hits_map

    @staticmethod
    def parse_access_list_brief(content: str) -> Dict[str, dict]:
        """
        Parse 'show access-list brief' to extract aggregated stats.
        Returns: { 
            "hash": { "hits": int, "last_hit": datetime } 
        }
        """
        stats_map = {}
        lines = content.splitlines()
        
        # Regex for line with at least 4 hex blocks
        # 1dcf0891 5db22105 00051d9b 6091b754
        pattern = re.compile(r'^\s*([0-9a-fA-F]{8})\s+([0-9a-fA-F]{8})\s+([0-9a-fA-F]{8})\s+([0-9a-fA-F]{8})')
        
        for line in lines:
            line = line.strip()
            match = pattern.search(line)
            if match:
                col1_hash = match.group(1).lower()
                col2_parent = match.group(2).lower()
                col3_hits_hex = match.group(3)
                col4_ts_hex = match.group(4)
                
                try:
                    hits = int(col3_hits_hex, 16)
                    ts = int(col4_ts_hex, 16)
                    
                    # 1. Update Self Hash (The actual ACE or Rule)
                    if col1_hash not in stats_map:
                        stats_map[col1_hash] = {"hits": 0, "last_hit_ts": 0}
                    
                    stats_map[col1_hash]["hits"] += hits
                    if ts > stats_map[col1_hash]["last_hit_ts"]:
                        stats_map[col1_hash]["last_hit_ts"] = ts

                    # 2. Update Parent Hash (If this is a child ACE)
                    # We aggregate hits to the parent so the group shows total hits
                    if col2_parent != "00000000":
                        if col2_parent not in stats_map:
                            stats_map[col2_parent] = {"hits": 0, "last_hit_ts": 0}
                        
                        stats_map[col2_parent]["hits"] += hits
                        if ts > stats_map[col2_parent]["last_hit_ts"]:
                            stats_map[col2_parent]["last_hit_ts"] = ts
                        
                except Exception:
                    continue
        
        # Convert Timestamps to Datetime
        final_map = {}
        for h, data in stats_map.items():
            dt = None
            if data["last_hit_ts"] > 946684800: # Year 2000
                dt = datetime.fromtimestamp(data["last_hit_ts"])
            
            final_map[h] = {
                "hits": data["hits"],
                "last_hit": dt
            }
            
        return final_map

    @staticmethod
    def extract_backup_timestamp(content: str) -> datetime:
        """
        Extract timestamp from 'show clock' output.
        Format: 14:23:45.123 UTC Mon Feb 5 2026
        """
        try:
            # Regex for standard Cisco 'show clock'
            # Matches: HH:MM:SS[.mmm] [TZ] Day Mon DD YYYY
            # Group 1: Time, Group 2: TZ, Group 3: Mon, Group 4: DD, Group 5: YYYY
            pattern = r'(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\S+)\s+\w+\s+(\w+)\s+(\d+)\s+(\d{4})'
            # Match
            # Regex 1: Standard Cisco 'show clock'
            # Matches: HH:MM:SS[.mmm] [TZ] Day Mon DD YYYY
            # Group 1: Time, Group 2: TZ, Group 3: Mon, Group 4: DD, Group 5: YYYY
            # Regex 1: Standard Cisco 'show clock' / 'Written by' with TZ
            # Matches: HH:MM:SS[.mmm] [TZ] Day Mon DD YYYY
            # Group 1: Time, Group 2: TZ, Group 3: Mon, Group 4: DD, Group 5: YYYY
            pattern = r'(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)\s+\w+\s+(\w+)\s+(\d+)\s+(\d{4})'
            match = re.search(pattern, content)

            if not match:
                # Regex 2: 'Written by... at HH:MM:SS [TZ] Mon Feb 10 2026'
                # Support optional TZ
                pattern = r'(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:\s+(\w+))?\s+\w+\s+(\w+)\s+(\d+)\s+(\d{4})'
                match = re.search(pattern, content)

            if not match:
                # Regex 3: Relaxed - Time ... Month Day Year
                # 14:24:28.123 ... Feb 10 2026
                pattern = r'(\d{2}:\d{2}:\d{2}(?:\.\d+)?).*?(\w{3})\s+(\d{1,2})\s+(\d{4})'
                match = re.search(pattern, content)
            
            if match:
                print(f"[DEBUG] Found Timestamp Match: {match.group(0)}")
                time_part = match.group(1).split('.')[0] # Remove ms for simpler parsing if needed
                tz_str = match.group(2).upper()
                month_str = match.group(3)
                day_str = match.group(4)
                year_str = match.group(5)
                
                # Construct string to parse: "05 Feb 2026 14:23:45"
                date_str = f"{day_str} {month_str} {year_str} {time_part}"
                print(f"[DEBUG] Parsing date string: {date_str} with TZ: {tz_str}")
                
                try:
                    naive_dt = datetime.strptime(date_str, "%d %b %Y %H:%M:%S")
                    
                    # Apply Timezone
                    if tz_str in ['UTC', 'GMT', 'Z']:
                        return naive_dt.replace(tzinfo=timezone.utc)
                    elif tz_str == 'WIB':
                        return naive_dt.replace(tzinfo=timezone(timedelta(hours=7)))
                    else:
                        return naive_dt
                except ValueError as ve:
                    print(f"[ERROR] Date parsing failed: {ve}")
                    return None
            else:
                print("[DEBUG] No timestamp match found in content (first 500 chars):")
                print(content[:500])


        except Exception as e:
            print(f"Time extraction error: {e}")
            return None
        return None
