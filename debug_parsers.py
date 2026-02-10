import sys
import os

# Add backend directory to path so we can import app modules
sys.path.append(r"d:\My Code\FirewallAnalyzer\backend")

from app.services.zip_parser import ZipParser

def debug_zip(zip_path):
    print(f"Debugging ZIP: {zip_path}")
    
    with open(zip_path, 'rb') as f:
        content_bytes = f.read()
        
    files = ZipParser.extract_zip(content_bytes)
    print(f"Extracted {len(files)} files.")
    for fname in files:
        print(f" - {fname}")
        
    contexts = ZipParser.identify_context_files(files)
    
    print("\nIdentified Contexts:")
    for ctx_name, ctx_data in contexts.items():
        print(f"Context: {ctx_name}")
        print(f"  Config Length: {len(ctx_data.get('config', ''))}")
        print(f"  Brief Length: {len(ctx_data.get('brief', ''))}")
        print(f"  Detailed Length: {len(ctx_data.get('detailed', ''))}")
        
        # Check for 'mon-ntp' in config or detailed
        if 'mon-ntp' in ctx_data.get('config', ''):
            print("  -> 'mon-ntp' found in CONFIG")
        if 'mon-ntp' in ctx_data.get('detailed', ''):
            print("  -> 'mon-ntp' found in DETAILED")

if __name__ == "__main__":
    zip_file = r"d:\My Code\FirewallAnalyzer\IDX-DC1-FWL03.zip"
    debug_zip(zip_file)
