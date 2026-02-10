"""Tests for PolicyMigrationService rename propagation to rules."""
import pytest
from app.services.migration import PolicyMigrationService


def _make_contexts():
    """Create two contexts with a conflicting object referenced in rules via 'object-group' prefix."""
    return [
        {
            "name": "CTX-A",
            "objects": [
                {"name": "DMZ_SERVERS", "value": "10.1.1.0/24", "type": "network"},
                {"name": "UNIQUE_OBJ_A", "value": "10.2.2.0/24", "type": "network"},
            ],
            "rules": [
                {
                    "name": "OUTSIDE-IN",
                    "source": "any",
                    "destination": "object-group DMZ_SERVERS",
                    "service": "tcp/443",
                    "action": "permit",
                    "hits": 100,
                    "children": [
                        {
                            "name": "OUTSIDE-IN",
                            "source": "any",
                            "destination": "object-group DMZ_SERVERS",
                            "service": "tcp/443",
                            "action": "permit",
                            "hits": 50,
                        }
                    ],
                },
                {
                    "name": "INSIDE-OUT",
                    "source": "object-group UNIQUE_OBJ_A",
                    "destination": "any",
                    "service": "ip",
                    "action": "permit",
                    "hits": 200,
                    "children": [],
                },
            ],
        },
        {
            "name": "CTX-B",
            "objects": [
                # Same name, DIFFERENT value → conflict
                {"name": "DMZ_SERVERS", "value": "192.168.1.0/24", "type": "network"},
            ],
            "rules": [
                {
                    "name": "OUTSIDE-IN",
                    "source": "any",
                    "destination": "object-group DMZ_SERVERS",
                    "service": "tcp/80",
                    "action": "permit",
                    "hits": 50,
                    "children": [],
                },
            ],
        },
    ]


def test_renamed_objects_reflected_in_rules():
    """Renamed objects must appear in unified rules with proper prefix."""
    contexts = _make_contexts()
    result = PolicyMigrationService.generate_unified_policy(contexts)
    
    rules = result["rules"]
    objects = result["objects"]
    
    # Objects should be renamed (DMZ_SERVERS_CTXA and DMZ_SERVERS_CTXB)
    obj_names = [o["name"] for o in objects]
    assert "DMZ_SERVERS_CTXA" in obj_names, f"Expected renamed object DMZ_SERVERS_CTXA, got: {obj_names}"
    assert "DMZ_SERVERS_CTXB" in obj_names, f"Expected renamed object DMZ_SERVERS_CTXB, got: {obj_names}"
    assert "DMZ_SERVERS" not in obj_names, "Original conflicting name should not remain"
    
    # Rules from CTX-A should reference "object-group DMZ_SERVERS_CTXA"
    ctx_a_rules = [r for r in rules if r.get("original_context") == "CTX-A"]
    outside_in_a = [r for r in ctx_a_rules if r["name"] == "OUTSIDE-IN"][0]
    assert outside_in_a["destination"] == "object-group DMZ_SERVERS_CTXA", \
        f"Expected 'object-group DMZ_SERVERS_CTXA', got '{outside_in_a['destination']}'"
    
    # Children should also be renamed
    if outside_in_a.get("children"):
        child = outside_in_a["children"][0]
        assert child["destination"] == "object-group DMZ_SERVERS_CTXA", \
            f"Child destination not renamed: '{child['destination']}'"
    
    # Rules from CTX-B should reference "object-group DMZ_SERVERS_CTXB"
    ctx_b_rules = [r for r in rules if r.get("original_context") == "CTX-B"]
    outside_in_b = [r for r in ctx_b_rules if r["name"] == "OUTSIDE-IN"][0]
    assert outside_in_b["destination"] == "object-group DMZ_SERVERS_CTXB", \
        f"Expected 'object-group DMZ_SERVERS_CTXB', got '{outside_in_b['destination']}'"


def test_non_conflicting_objects_keep_name():
    """Unique objects should NOT be renamed."""
    contexts = _make_contexts()
    result = PolicyMigrationService.generate_unified_policy(contexts)
    
    rules = result["rules"]
    
    # UNIQUE_OBJ_A has no conflict, so rule should keep "object-group UNIQUE_OBJ_A"
    ctx_a_rules = [r for r in rules if r.get("original_context") == "CTX-A"]
    inside_out = [r for r in ctx_a_rules if r["name"] == "INSIDE-OUT"][0]
    assert inside_out["source"] == "object-group UNIQUE_OBJ_A", \
        f"Non-conflicting object was wrongly renamed: '{inside_out['source']}'"


def test_plain_ip_references_unaffected():
    """Rules using plain IPs or 'any' should not be affected by rename logic."""
    contexts = _make_contexts()
    result = PolicyMigrationService.generate_unified_policy(contexts)
    
    rules = result["rules"]
    
    # All rules with source "any" should remain "any"
    for r in rules:
        if r["source"] == "any":
            assert r["source"] == "any"


def test_object_prefix_without_group():
    """Test 'object NAME' prefix (not just 'object-group NAME')."""
    contexts = [
        {
            "name": "CTX-1",
            "objects": [{"name": "WEB_SRV", "value": "10.0.0.1", "type": "network"}],
            "rules": [{
                "name": "ACL1", "source": "object WEB_SRV", "destination": "any",
                "service": "ip", "action": "permit", "hits": 0, "children": []
            }],
        },
        {
            "name": "CTX-2",
            "objects": [{"name": "WEB_SRV", "value": "172.16.0.1", "type": "network"}],
            "rules": [{
                "name": "ACL1", "source": "object WEB_SRV", "destination": "any",
                "service": "ip", "action": "permit", "hits": 0, "children": []
            }],
        },
    ]
    
    result = PolicyMigrationService.generate_unified_policy(contexts)
    rules = result["rules"]
    
    ctx1_rule = [r for r in rules if r.get("original_context") == "CTX-1"][0]
    ctx2_rule = [r for r in rules if r.get("original_context") == "CTX-2"][0]
    
    assert ctx1_rule["source"] == "object WEB_SRV_CTX1", \
        f"Expected 'object WEB_SRV_CTX1', got '{ctx1_rule['source']}'"
    assert ctx2_rule["source"] == "object WEB_SRV_CTX2", \
        f"Expected 'object WEB_SRV_CTX2', got '{ctx2_rule['source']}'"
