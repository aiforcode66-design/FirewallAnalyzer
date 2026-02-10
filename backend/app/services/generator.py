from app.services.parser import ConfigParser
from app.models.rule import FirewallRule
from typing import List, Set
import re

class ConfigGenerator:
    @staticmethod
    def _collect_all_rules(rule_list: List[dict]) -> List[dict]:
        """Recursively collect all rules including children."""
        all_rules = []
        for r in rule_list:
            all_rules.append(r)
            if r.get("children"):
                all_rules.extend(ConfigGenerator._collect_all_rules(r["children"]))
        return all_rules

    @staticmethod
    def generate_optimized_config(original_content: str, active_rules: List[FirewallRule], vendor_name: str = "cisco") -> str:
        """
        Generates optimized config by commenting out rules NOT present in active_rules.
        Uses Hash Matching for 100% accuracy.
        """
        
        # 1. Build Active Hash Set
        # We use the stored rule_hash (normalized in devices.py)
        active_hashes = set()
        for r in active_rules:
            if r.rule_hash:
                active_hashes.add(r.rule_hash)
            
        # 2. Parse Original Content to identify Rule Lines
        # Parse returns structured rules (hierarchical)
        parsed_structure = ConfigParser.parse(vendor_name, original_content).get("rules_data", [])
        
        # Flatten the structure to get ALL rules (parents + children)
        all_parsed_rules = ConfigGenerator._collect_all_rules(parsed_structure)
        
        # Map: Raw Line String -> Keep/Remove
        lines_to_comment = set()
        
        for r in all_parsed_rules:
            # Get Hash from Parsed Data
            raw_hash = r.get("hash")
            
            # Identify if Rule should be kept
            is_active = False
            
            if raw_hash:
                # Normalize to match DB storage
                norm_hash = raw_hash.lower().replace("0x", "")
                if norm_hash in active_hashes:
                    is_active = True
                    
            # If NO hash found (maybe comment or invalid rule), or Hash NOT active -> MARK DELETE
            # For child rules, they might not have separate existence in active_rules if only Parent is tracked?
            # Actually, `active_rules` from DB includes children (each child is a FirewallRule row).
            # So checking child hash against active_hashes IS correct.
            
            if raw_hash and not is_active:
                # This rule has a hash, but that hash is NOT in our active list.
                # So it must have been deleted.
                raw_line = r.get("raw", "").strip()
                lines_to_comment.add(raw_line)
                
        # 3. Process File Line by Line
        output_lines = []
        for line in original_content.splitlines():
            stripped = line.strip()
            
            if stripped in lines_to_comment:
                # Maintain indentation if possible? 
                # Prefixing with ! breaks indentation context usually, but it's a comment now.
                output_lines.append(f"! [REMOVED] {line}")
            else:
                output_lines.append(line)
                
        return "\n".join(output_lines)
