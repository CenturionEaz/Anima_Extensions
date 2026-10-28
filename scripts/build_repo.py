#!/usr/bin/env python3
"""
Anima Extension Repository Builder
Scans javascript/ directory, compiles index.json, anime_index.json, novel_index.json,
and generates an interactive, high-aesthetic README.md with 1-click install links.
"""

import json
import os
import re
import sys
import zlib
import subprocess
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
CONFIG_FILE = ROOT_DIR / "repo_config.json"
REPO_FILE = ROOT_DIR / "repo.json"

def get_git_remote_info():
    """Extract owner and repo name from git remote if configured."""
    try:
        result = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            check=False
        )
        url = result.stdout.strip()
        if url:
            # Matches https://github.com/owner/repo(.git) or git@github.com:owner/repo(.git)
            m = re.search(r"github\.com[/:]([^/]+)/([^/\.]+)", url)
            if m:
                return m.group(1), m.group(2)
    except Exception:
        pass
    return None, None

def load_config():
    default_config = {
        "github_username": "PratyushRai",
        "repo_name": "Anima_Extensions",
        "branch": "main",
        "repo_display_name": "Anima Custom Extensions",
        "author": "Pratyush Rai",
        "description": "Curated, high-speed custom extensions for AnymeX and Mangayomi."
    }
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                user_config = json.load(f)
                default_config.update(user_config)
        except Exception as e:
            print(f"[!] Warning reading config: {e}")

    # Auto-detect git remote if available
    remote_owner, remote_repo = get_git_remote_info()
    if remote_owner and remote_repo:
        default_config["github_username"] = remote_owner
        default_config["repo_name"] = remote_repo

    return default_config

def generate_source_id(name: str, lang: str) -> int:
    """Generate deterministic 32-bit positive integer ID for a source."""
    seed = f"{name.strip().lower()}_{lang.strip().lower()}"
    crc = zlib.crc32(seed.encode("utf-8")) & 0x7FFFFFFF
    return crc if crc != 0 else 100000001

def extract_sources_from_js(file_path: Path, config: dict):
    content = file_path.read_text(encoding="utf-8")
    rel_path = file_path.relative_to(ROOT_DIR).as_posix()
    
    # Match const/var/let mangayomiSources = [ ... ];
    match = re.search(r'(?:const|var|let)\s+mangayomiSources\s*=\s*(\[.*?\])\s*;', content, re.DOTALL)
    if not match:
        return []

    raw_json = match.group(1)
    # Remove trailing commas in objects/arrays for standard JSON compatibility
    clean_json = re.sub(r',\s*([\]}])', r'\1', raw_json)
    
    try:
        sources_meta = json.loads(clean_json)
    except Exception as e:
        print(f"[!] JSON parsing error in {rel_path}: {e}")
        return []

    processed = []
    owner = config["github_username"]
    repo = config["repo_name"]
    branch = config["branch"]
    raw_base = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}"

    for src in sources_meta:
        name = src.get("name", "Unknown Source")
        lang = src.get("lang", "en")
        item_type = src.get("itemType", 0)
        
        # Determine itemType if missing based on directory
        if "itemType" not in src:
            if "anime" in rel_path:
                item_type = 1
            elif "novel" in rel_path:
                item_type = 2
            else:
                item_type = 0

        # Deterministic ID if missing or invalid
        sid = src.get("id")
        if not sid or sid == 0:
            sid = generate_source_id(name, lang)

        base_url = src.get("baseUrl", "").rstrip("/")
        icon_url = src.get("iconUrl", "")
        if not icon_url and base_url:
            icon_url = f"https://www.google.com/s2/favicons?sz=256&domain={base_url}"

        source_code_url = src.get("sourceCodeUrl")
        if not source_code_url or "github.com" in source_code_url:
            source_code_url = f"{raw_base}/{rel_path}"

        is_manga = (item_type == 0)

        entry = {
            "name": name,
            "id": int(sid),
            "baseUrl": base_url,
            "lang": lang,
            "typeSource": src.get("typeSource", "single"),
            "iconUrl": icon_url,
            "dateFormat": src.get("dateFormat", ""),
            "dateFormatLocale": src.get("dateFormatLocale", ""),
            "isNsfw": bool(src.get("isNsfw", False)),
            "hasCloudflare": bool(src.get("hasCloudflare", False)),
            "sourceCodeUrl": source_code_url,
            "apiUrl": src.get("apiUrl", ""),
            "version": src.get("version", "0.0.1"),
            "isManga": is_manga,
            "itemType": item_type,
            "isFullData": bool(src.get("isFullData", False)),
            "appMinVerReq": src.get("appMinVerReq", "0.1.0"),
            "additionalParams": src.get("additionalParams", ""),
            "sourceCodeLanguage": 1,  # 1 for JavaScript
            "notes": src.get("notes", f"Maintained in {repo}"),
            "_file_rel": rel_path
        }
        processed.append(entry)

    return processed

def generate_readme(config: dict, manga_list: list, anime_list: list, novel_list: list):
    owner = config["github_username"]
    repo = config["repo_name"]
    branch = config["branch"]
    display_name = config.get("repo_display_name", repo)
    desc = config.get("description", "Custom extension repository.")

    raw_prefix = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}"
    manga_url = f"{raw_prefix}/index.json"
    anime_url = f"{raw_prefix}/anime_index.json"
    novel_url = f"{raw_prefix}/novel_index.json"
    repo_url = f"https://github.com/{owner}/{repo}"

    # Build 1-click protocol URLs
    add_all_query = (
        f"mangayomi://add-repo?repo_name={repo}"
        f"&repo_url={repo_url}"
        f"&manga_url={manga_url}"
        f"&anime_url={anime_url}"
        f"&novel_url={novel_url}"
    )
    add_manga_query = f"mangayomi://add-repo?repo_name={repo}&repo_url={repo_url}&manga_url={manga_url}"
    add_anime_query = f"mangayomi://add-repo?repo_name={repo}&repo_url={repo_url}&anime_url={anime_url}"
    add_novel_query = f"mangayomi://add-repo?repo_name={repo}&repo_url={repo_url}&novel_url={novel_url}"

    redirector = "https://intradeus.github.io/http-protocol-redirector?r="
    
    total_sources = len(manga_list) + len(anime_list) + len(novel_list)

    readme_content = f"""# 🌟 {display_name}

> {desc}  
> Built for **[AnymeX](https://github.com/RyanYuuki/AnymeX)** & **[Mangayomi](https://github.com/kodjodevf/mangayomi)**.

![Total Sources](https://img.shields.io/badge/Total%20Sources-{total_sources}-brightgreen?style=for-the-badge)
![Anime](https://img.shields.io/badge/Anime%20Sources-{len(anime_list)}-informational?style=for-the-badge)
![Manga](https://img.shields.io/badge/Manga%20Sources-{len(manga_list)}-orange?style=for-the-badge)
![Novels](https://img.shields.io/badge/Novel%20Sources-{len(novel_list)}-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)

---

## ⚡ 1-Click Install into AnymeX / Mangayomi

If you are viewing this page on your phone or desktop with AnymeX / Mangayomi installed, tap the buttons below:

| Action | One-Click Button |
| :--- | :--- |
| **Add All Repositories** (Anime, Manga, Novels) | [![Add All Repositories](https://img.shields.io/badge/📥%20Add%20All%20Repositories-3b82f6?style=for-the-badge)]({redirector}{add_all_query}) |
| **Add Anime Only** | [![Add Anime](https://img.shields.io/badge/📺%20Add%20Anime%20Repo-10b981?style=for-the-badge)]({redirector}{add_anime_query}) |
| **Add Manga Only** | [![Add Manga](https://img.shields.io/badge/📖%20Add%20Manga%20Repo-f59e0b?style=for-the-badge)]({redirector}{add_manga_query}) |
| **Add Novels Only** | [![Add Novels](https://img.shields.io/badge/📚%20Add%20Novel%20Repo-8b5cf6?style=for-the-badge)]({redirector}{add_novel_query}) |

---

## 📋 Manual Repository URLs

To add manually inside **AnymeX**:
1. Open **AnymeX**.
2. Tap **More** (Bottom Navigation) ➔ **Settings** ➔ **Browse / Extensions** ➔ **Repositories**.
3. Tap **Add Repository (+)** and paste the link according to category:

```text
# Anime Repository Index
{anime_url}

# Manga Repository Index
{manga_url}

# Light Novel Repository Index
{novel_url}
```

---

## 📦 Available Sources

### 📺 Anime Sources ({len(anime_list)})
"""
    if anime_list:
        readme_content += "| Source | Lang | Version | NSFW | Cloudflare | Website | Source Code |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
        for s in anime_list:
            nsfw_badge = "🔞 Yes" if s["isNsfw"] else "No"
            cf_badge = "🛡️ Yes" if s["hasCloudflare"] else "No"
            readme_content += f"| **{s['name']}** | `{s['lang']}` | `v{s['version']}` | {nsfw_badge} | {cf_badge} | [Link]({s['baseUrl']}) | [Code]({s['_file_rel']}) |\n"
    else:
        readme_content += "*No anime sources added yet. Drop JS files into `javascript/anime/src/en/` and run `python scripts/build_repo.py`.*\n"

    readme_content += f"\n### 📖 Manga & Comic Sources ({len(manga_list)})\n"
    if manga_list:
        readme_content += "| Source | Lang | Version | NSFW | Cloudflare | Website | Source Code |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
        for s in manga_list:
            nsfw_badge = "🔞 Yes" if s["isNsfw"] else "No"
            cf_badge = "🛡️ Yes" if s["hasCloudflare"] else "No"
            readme_content += f"| **{s['name']}** | `{s['lang']}` | `v{s['version']}` | {nsfw_badge} | {cf_badge} | [Link]({s['baseUrl']}) | [Code]({s['_file_rel']}) |\n"
    else:
        readme_content += "*No manga sources added yet. Drop JS files into `javascript/manga/src/en/` and run `python scripts/build_repo.py`.*\n"

    readme_content += f"\n### 📚 Novel Sources ({len(novel_list)})\n"
    if novel_list:
        readme_content += "| Source | Lang | Version | NSFW | Cloudflare | Website | Source Code |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
        for s in novel_list:
            nsfw_badge = "🔞 Yes" if s["isNsfw"] else "No"
            cf_badge = "🛡️ Yes" if s["hasCloudflare"] else "No"
            readme_content += f"| **{s['name']}** | `{s['lang']}` | `v{s['version']}` | {nsfw_badge} | {cf_badge} | [Link]({s['baseUrl']}) | [Code]({s['_file_rel']}) |\n"
    else:
        readme_content += "*No novel sources added yet. Drop JS files into `javascript/novel/src/en/` and run `python scripts/build_repo.py`.*\n"

    readme_content += """
---

## 🛠️ How To Add or Update Sources

1. **Add or Edit Extension**:
   - For Anime: Create or modify a `.js` file in `javascript/anime/src/<lang>/<source_name>.js`
   - For Manga: Create or modify a `.js` file in `javascript/manga/src/<lang>/<source_name>.js`
   - For Novels: Create or modify a `.js` file in `javascript/novel/src/<lang>/<source_name>.js`
   - Use the templates in `templates/` for clean starter code!

2. **Generate Indexes & Commit**:
   ```bash
   python scripts/build_repo.py
   git add .
   git commit -m "Add/update sources"
   git push
   ```
   *GitHub Actions will also automatically re-verify and update the indexes on every push!*

---

## 📄 License
This repository is released under the [MIT License](LICENSE).
"""
    return readme_content

def main():
    print("==============================================")
    print("   Anima Extension Repository Builder")
    print("==============================================\n")

    config = load_config()
    print(f"[*] Target GitHub: {config['github_username']}/{config['repo_name']} (Branch: {config['branch']})")

    js_dir = ROOT_DIR / "javascript"
    if not js_dir.exists():
        js_dir.mkdir(parents=True, exist_ok=True)

    all_sources = []
    for js_file in js_dir.rglob("*.js"):
        extracted = extract_sources_from_js(js_file, config)
        if extracted:
            print(f"[+] Loaded {len(extracted)} source(s) from {js_file.relative_to(ROOT_DIR)}")
            all_sources.extend(extracted)

    manga_sources = [s for s in all_sources if s["itemType"] == 0]
    anime_sources = [s for s in all_sources if s["itemType"] == 1]
    novel_sources = [s for s in all_sources if s["itemType"] == 2]

    # Clean out internal metadata before saving json index
    def clean_for_index(items):
        out = []
        for item in items:
            c = dict(item)
            c.pop("_file_rel", None)
            out.append(c)
        return out

    # Write index.json (Manga)
    index_file = ROOT_DIR / "index.json"
    index_file.write_text(json.dumps(clean_for_index(manga_sources), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[✓] Wrote {len(manga_sources)} Manga source(s) to index.json")

    # Write anime_index.json (Anime)
    anime_file = ROOT_DIR / "anime_index.json"
    anime_file.write_text(json.dumps(clean_for_index(anime_sources), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[✓] Wrote {len(anime_sources)} Anime source(s) to anime_index.json")

    # Write novel_index.json (Novel)
    novel_file = ROOT_DIR / "novel_index.json"
    novel_file.write_text(json.dumps(clean_for_index(novel_sources), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[✓] Wrote {len(novel_sources)} Novel source(s) to novel_index.json")

    # Update repo.json
    repo_meta = {
        "name": config.get("repo_display_name", config["repo_name"]),
        "website": f"https://github.com/{config['github_username']}/{config['repo_name']}"
    }
    REPO_FILE.write_text(json.dumps(repo_meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[✓] Updated repo.json")

    # Write README.md
    readme_content = generate_readme(config, manga_sources, anime_sources, novel_sources)
    (ROOT_DIR / "README.md").write_text(readme_content, encoding="utf-8")
    print(f"[✓] Generated README.md with one-click installation badges")

    print("\n[🎉] Repository build completed successfully!")

if __name__ == "__main__":
    main()
