# 🌟 Anima Custom Extensions

> Curated, high-speed custom extensions for AnymeX and Mangayomi.  
> Built for **[AnymeX](https://github.com/RyanYuuki/AnymeX)** & **[Mangayomi](https://github.com/kodjodevf/mangayomi)**.

![Total Sources](https://img.shields.io/badge/Total%20Sources-0-brightgreen?style=for-the-badge)
![Anime](https://img.shields.io/badge/Anime%20Sources-0-informational?style=for-the-badge)
![Manga](https://img.shields.io/badge/Manga%20Sources-0-orange?style=for-the-badge)
![Novels](https://img.shields.io/badge/Novel%20Sources-0-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)

---

## ⚡ 1-Click Install into AnymeX / Mangayomi

If you are viewing this page on your phone or desktop with AnymeX / Mangayomi installed, tap the buttons below:

| Action | One-Click Button |
| :--- | :--- |
| **Add All Repositories** (Anime, Manga, Novels) | [![Add All Repositories](https://img.shields.io/badge/📥%20Add%20All%20Repositories-3b82f6?style=for-the-badge)](https://intradeus.github.io/http-protocol-redirector?r=mangayomi://add-repo?repo_name=Anima_Extensions&repo_url=https://github.com/PratyushRai/Anima_Extensions&manga_url=https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/index.json&anime_url=https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/anime_index.json&novel_url=https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/novel_index.json) |
| **Add Anime Only** | [![Add Anime](https://img.shields.io/badge/📺%20Add%20Anime%20Repo-10b981?style=for-the-badge)](https://intradeus.github.io/http-protocol-redirector?r=mangayomi://add-repo?repo_name=Anima_Extensions&repo_url=https://github.com/PratyushRai/Anima_Extensions&anime_url=https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/anime_index.json) |
| **Add Manga Only** | [![Add Manga](https://img.shields.io/badge/📖%20Add%20Manga%20Repo-f59e0b?style=for-the-badge)](https://intradeus.github.io/http-protocol-redirector?r=mangayomi://add-repo?repo_name=Anima_Extensions&repo_url=https://github.com/PratyushRai/Anima_Extensions&manga_url=https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/index.json) |
| **Add Novels Only** | [![Add Novels](https://img.shields.io/badge/📚%20Add%20Novel%20Repo-8b5cf6?style=for-the-badge)](https://intradeus.github.io/http-protocol-redirector?r=mangayomi://add-repo?repo_name=Anima_Extensions&repo_url=https://github.com/PratyushRai/Anima_Extensions&novel_url=https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/novel_index.json) |

---

## 📋 Manual Repository URLs

To add manually inside **AnymeX**:
1. Open **AnymeX**.
2. Tap **More** (Bottom Navigation) ➔ **Settings** ➔ **Browse / Extensions** ➔ **Repositories**.
3. Tap **Add Repository (+)** and paste the link according to category:

```text
# Anime Repository Index
https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/anime_index.json

# Manga Repository Index
https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/index.json

# Light Novel Repository Index
https://raw.githubusercontent.com/PratyushRai/Anima_Extensions/main/novel_index.json
```

---

## 📦 Available Sources

### 📺 Anime Sources (0)
*No anime sources added yet. Drop JS files into `javascript/anime/src/en/` and run `python scripts/build_repo.py`.*

### 📖 Manga & Comic Sources (0)
*No manga sources added yet. Drop JS files into `javascript/manga/src/en/` and run `python scripts/build_repo.py`.*

### 📚 Novel Sources (0)
*No novel sources added yet. Drop JS files into `javascript/novel/src/en/` and run `python scripts/build_repo.py`.*

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
