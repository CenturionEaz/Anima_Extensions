#!/usr/bin/env python3
"""
Test and validate Mangayomi / AnymeX JavaScript extension sources.
Validates:
1. Syntax correctness via Node.js (`node -c <file>`)
2. `mangayomiSources` metadata presence and correctness
3. Class `DefaultExtension` implementation of required MProvider methods
"""

import sys
import subprocess
import json
import re
from pathlib import Path

# Fix Windows console unicode encoding
if sys.platform == "win32":
    import io
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT_DIR = Path(__file__).resolve().parent.parent

def test_file(file_path: Path):
    print(f"\n[*] Validating: {file_path.relative_to(ROOT_DIR)}")
    
    # 1. Syntax check via Node.js
    node_res = subprocess.run(["node", "-c", str(file_path)], capture_output=True, text=True)
    if node_res.returncode != 0:
        print(f" [❌] Syntax Error in JS:")
        print(node_res.stderr)
        return False
    else:
        print(" [✓] JavaScript Syntax: OK")

    content = file_path.read_text(encoding="utf-8")

    # 2. Check metadata
    match = re.search(r'(?:const|var|let)\s+mangayomiSources\s*=\s*(\[.*?\])\s*;', content, re.DOTALL)
    if not match:
        print(" [❌] Missing `const mangayomiSources = [...];` array.")
        return False

    try:
        clean_json = re.sub(r',\s*([\]}])', r'\1', match.group(1))
        sources = json.loads(clean_json)
        print(f" [✓] Found {len(sources)} source metadata entry(ies).")
        for src in sources:
            name = src.get("name", "Unknown")
            item_type = src.get("itemType", 0)
            base_url = src.get("baseUrl", "")
            print(f"     - Name: {name} (itemType: {item_type}, Base: {base_url})")
            if not base_url:
                print("       [!] Warning: baseUrl is empty.")
    except Exception as e:
        print(f" [❌] Metadata JSON parse error: {e}")
        return False

    # 3. Check methods
    required_methods = ["getPopular", "getLatestUpdates", "search", "getDetail"]
    missing = []
    for m in required_methods:
        if f"{m}(" not in content:
            missing.append(m)

    if missing:
        print(f" [!] Warning: Missing standard methods: {', '.join(missing)}")
    else:
        print(" [✓] Core MProvider methods found.")

    return True

def main():
    if len(sys.argv) > 1:
        target = Path(sys.argv[1])
        if target.is_file():
            test_file(target)
        else:
            for f in target.rglob("*.js"):
                test_file(f)
    else:
        print("Scanning all sources in javascript/ ...")
        found = list((ROOT_DIR / "javascript").rglob("*.js"))
        if not found:
            print("No JavaScript extensions found yet.")
            return
        success = True
        for f in found:
            if not test_file(f):
                success = False
        print("\n" + ("="*40))
        if success:
            print("[🎉] All extension files passed validation!")
        else:
            print("[⚠️] Some files had issues. Review errors above.")

if __name__ == "__main__":
    main()
