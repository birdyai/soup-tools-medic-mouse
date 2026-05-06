#!/usr/bin/env python3
"""Validate the medical rules database files."""

import json
import os
from pathlib import Path

def validate_json_file(filepath):
    """Validate a JSON file is properly formatted."""
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        print(f"✓ {filepath.name} - Valid JSON ({len(str(data))} chars)")
        return True, data
    except json.JSONDecodeError as e:
        print(f"✗ {filepath.name} - Invalid JSON: {e}")
        return False, None
    except Exception as e:
        print(f"✗ {filepath.name} - Error: {e}")
        return False, None

def validate_medical_rules(data):
    """Validate medical-rules.json structure."""
    required_keys = ['version', 'universal_rejections', 'conditions', 'clinics', 'medications', 'treatments']
    missing = [k for k in required_keys if k not in data]
    
    if missing:
        print(f"  Missing required keys: {missing}")
        return False
    
    # Check some data exists
    stats = {
        'universal_rejections': len(data['universal_rejections'].get('conditions', [])),
        'conditions': len(data['conditions']),
        'clinics': len(data['clinics']),
        'medications': sum(len(v.get('medications', [])) for v in data['medications'].values()),
        'treatments': len(data['treatments'])
    }
    
    print("  Data statistics:")
    for key, count in stats.items():
        print(f"    - {key}: {count} entries")
    
    return True

def validate_sample_queries(data):
    """Validate sample-queries.json structure."""
    if 'test_queries' not in data:
        print("  Missing 'test_queries' key")
        return False
    
    print(f"  Found {len(data['test_queries'])} test queries")
    print(f"  Found {len(data.get('fuzzy_match_tests', []))} fuzzy match tests")
    
    return True

def main():
    """Run validation on all JSON files."""
    data_dir = Path(__file__).parent
    
    print("Validating Medic Mouse data files...\n")
    
    # Validate medical-rules.json
    rules_file = data_dir / "medical-rules.json"
    valid, rules_data = validate_json_file(rules_file)
    if valid:
        validate_medical_rules(rules_data)
    
    print()
    
    # Validate sample-queries.json
    queries_file = data_dir / "sample-queries.json"
    valid, queries_data = validate_json_file(queries_file)
    if valid:
        validate_sample_queries(queries_data)
    
    print("\n✅ Validation complete!")

if __name__ == "__main__":
    main()