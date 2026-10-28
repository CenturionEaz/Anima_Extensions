/**
 * Comix Extension for AnymeX & Mangayomi
 * itemType: 0 (Manga)
 */

const mangayomiSources = [
  {
    "id": 5738565392,
    "name": "Comix",
    "lang": "en",
    "baseUrl": "https://comix.to",
    "apiUrl": "https://comix.to/api/v1/",
    "iconUrl": "https://comix.to/images/icon_512x512.png",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.1.1",
    "hasCloudflare": true,
    "notes": "Uses SSR initial-data & WebView reader",
    "pkgPath": "manga/src/en/comix.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get baseUrl() {
    return (this.source && this.source.baseUrl) ? this.source.baseUrl : "https://comix.to";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://comix.to/"
    };
  }

  extractInitialData(html) {
    if (!html) return null;
    const match = html.match(/<script\b[^>]*id="initial-data"[^>]*>([\s\S]*?)<\/script>/i);
    if (!match || !match[1]) return null;
    try {
      return JSON.parse(match[1]);
    } catch (_) {
      return null;
    }
  }

  mangaFromItem(item) {
    if (!item) return null;
    const name = item.title || "";
    const hid = item.hid || item.id || "";
    let imageUrl = "";
    if (item.poster) {
      if (typeof item.poster === "string") {
        imageUrl = item.poster;
      } else if (typeof item.poster === "object") {
        imageUrl = item.poster.large || item.poster.medium || item.poster.small || "";
      }
    }
    const link = `${this.baseUrl}/title/${hid}`;
    return { name, link, imageUrl };
  }

  async getPopular(page) {
    const res = await this.client.get(`${this.baseUrl}/`, this.headers);
    const data = this.extractInitialData(res.body || "");
    const queries = (data && data.queries) || {};

    const list = [];
    const seen = {};

    for (const k of Object.keys(queries)) {
      if (k.includes('"manga"') && (k.includes('"top"') || k.includes('"trending"') || k.includes('"follows"'))) {
        const raw = queries[k];
        const items = Array.isArray(raw) ? raw : (raw.items || []);
        for (const it of items) {
          const m = this.mangaFromItem(it);
          if (m && m.name && !seen[m.link]) {
            seen[m.link] = true;
            list.push(m);
          }
        }
      }
    }

    return { list, hasNextPage: false };
  }

  async getLatestUpdates(page) {
    const res = await this.client.get(`${this.baseUrl}/`, this.headers);
    const data = this.extractInitialData(res.body || "");
    const queries = (data && data.queries) || {};

    const list = [];
    const seen = {};

    for (const k of Object.keys(queries)) {
      if (k.includes('"manga"') && k.includes('"list"')) {
        const raw = queries[k];
        const items = Array.isArray(raw) ? raw : (raw.items || []);
        for (const it of items) {
          const m = this.mangaFromItem(it);
          if (m && m.name && !seen[m.link]) {
            seen[m.link] = true;
            list.push(m);
          }
        }
      }
    }

    return { list, hasNextPage: false };
  }

  async search(query, page, filters) {
    const q = (query || "").trim();
    if (!q) {
      return await this.getPopular(page);
    }

    // 1. Try webview search interaction
    try {
      const searchScript = `
        (async function() {
          try {
            const input = document.querySelector('input[placeholder*="Search"]');
            if (input) {
              input.value = ${JSON.stringify(q)};
              input.dispatchEvent(new Event('input', { bubbles: true }));
              for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 200));
                const items = document.querySelectorAll('.search-results a, .search__result a, a[href*="/title/"]');
                if (items.length > 0) {
                  const list = Array.from(items).map(a => {
                    const titleEl = a.querySelector('.title, h4, h5, span') || a;
                    const imgEl = a.querySelector('img');
                    return {
                      name: titleEl.textContent.trim(),
                      link: a.getAttribute('href') || '',
                      imageUrl: imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : ''
                    };
                  }).filter(x => x.name && x.link && x.link.includes('/title/'));
                  if (list.length > 0) {
                    window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(list));
                    return;
                  }
                }
              }
            }
            window.flutter_inappwebview.callHandler('setResponse', JSON.stringify([]));
          } catch(e) {
            window.flutter_inappwebview.callHandler('setResponse', 'ERROR:' + e.message);
          }
        })()
      `;
      const resStr = await evaluateJavascriptViaWebview(`${this.baseUrl}/`, {}, [searchScript]);
      if (resStr && !resStr.startsWith("ERROR:")) {
        const parsed = JSON.parse(resStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map(item => ({
            name: item.name,
            link: item.link.startsWith("http") ? item.link : `${this.baseUrl}${item.link.startsWith("/") ? "" : "/"}${item.link}`,
            imageUrl: item.imageUrl
          }));
          return { list, hasNextPage: false };
        }
      }
    } catch (_) {}

    // 2. Fallback: search across all preloaded items on home page
    try {
      const res = await this.client.get(`${this.baseUrl}/`, this.headers);
      const data = this.extractInitialData(res.body || "");
      const queries = (data && data.queries) || {};
      const list = [];
      const seen = {};
      const lowerQ = q.toLowerCase();

      for (const k of Object.keys(queries)) {
        if (k.includes('"manga"')) {
          const raw = queries[k];
          const items = Array.isArray(raw) ? raw : (raw.items || []);
          for (const it of items) {
            if (it && it.title && it.title.toLowerCase().includes(lowerQ)) {
              const m = this.mangaFromItem(it);
              if (m && !seen[m.link]) {
                seen[m.link] = true;
                list.push(m);
              }
            }
          }
        }
      }
      if (list.length > 0) {
        return { list, hasNextPage: false };
      }
    } catch (_) {}

    return { list: [], hasNextPage: false };
  }

  async getDetail(url) {
    let fullUrl = url;
    if (!fullUrl.startsWith("http")) {
      fullUrl = `${this.baseUrl}${fullUrl.startsWith("/") ? "" : "/"}${fullUrl}`;
    }

    const res = await this.client.get(fullUrl, this.headers);
    const html = res.body || "";
    const data = this.extractInitialData(html);
    const queries = (data && data.queries) || {};

    let detail = null;
    for (const k of Object.keys(queries)) {
      if (k.includes('"manga"') && k.includes('"detail"')) {
        detail = queries[k];
        break;
      }
    }

    const doc = new Document(html);
    const titleEl = doc.selectFirst("h1");
    const name = (detail && detail.title) || (titleEl ? titleEl.text.trim() : "");

    let imageUrl = "";
    if (detail && detail.poster) {
      imageUrl = typeof detail.poster === "string" ? detail.poster : (detail.poster.large || detail.poster.medium || detail.poster.small || "");
    }
    if (!imageUrl) {
      const imgEl = doc.selectFirst("img.cover, .poster img, img");
      imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";
    }

    const description = (detail && (detail.synopsis || detail.description)) || "";
    const author = (detail && detail.authors && detail.authors.map(a => a.title).join(", ")) || "";
    const artist = (detail && detail.artists && detail.artists.map(a => a.title).join(", ")) || "";

    const genres = [];
    if (detail && detail.genres) {
      detail.genres.forEach(g => genres.push(g.title));
    }
    if (detail && detail.tags) {
      detail.tags.forEach(t => genres.push(t.title));
    }

    const status = detail && detail.status === "finished" ? 1 : (detail && detail.status === "releasing" ? 0 : 5);

    // Fetch chapters via WebView or initial data
    let chapters = [];
    try {
      const chapterScript = `
        (async function() {
          try {
            for (let i = 0; i < 25; i++) {
              const links = document.querySelectorAll('a[href*="-chapter-"], a[href*="/chapter/"], .chapter-list a');
              if (links.length > 0) {
                const chs = Array.from(links).map(a => ({
                  name: a.textContent.trim() || a.getAttribute('title') || 'Chapter',
                  url: a.href
                })).filter(c => c.url && (c.url.includes('-chapter-') || c.url.includes('/chapter/')));
                if (chs.length > 0) {
                  window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(chs));
                  return;
                }
              }
              await new Promise(r => setTimeout(r, 200));
            }
            window.flutter_inappwebview.callHandler('setResponse', JSON.stringify([]));
          } catch(e) {
            window.flutter_inappwebview.callHandler('setResponse', 'ERROR:' + e.message);
          }
        })()
      `;
      const chRes = await evaluateJavascriptViaWebview(fullUrl, {}, [chapterScript]);
      if (chRes && !chRes.startsWith("ERROR:")) {
        const parsed = JSON.parse(chRes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          chapters = parsed;
        }
      }
    } catch (_) {}

    if (chapters.length === 0 && detail) {
      if (detail.latestChapterUrl) {
        chapters.push({
          name: `Chapter ${detail.latestChapter || "Latest"}`,
          url: detail.latestChapterUrl.startsWith("http") ? detail.latestChapterUrl : `${this.baseUrl}${detail.latestChapterUrl}`
        });
      }
      if (detail.firstChapterUrl && detail.firstChapterUrl !== detail.latestChapterUrl) {
        chapters.push({
          name: "Chapter 1",
          url: detail.firstChapterUrl.startsWith("http") ? detail.firstChapterUrl : `${this.baseUrl}${detail.firstChapterUrl}`
        });
      }
    }

    return {
      name,
      imageUrl,
      description,
      author,
      artist,
      genre: genres,
      status,
      chapters
    };
  }

  async getPageList(url) {
    let fullUrl = url;
    if (!fullUrl.startsWith("http")) {
      fullUrl = `${this.baseUrl}${fullUrl.startsWith("/") ? "" : "/"}${fullUrl}`;
    }

    try {
      const readerScript = `
        (async function() {
          try {
            for (let i = 0; i < 30; i++) {
              const imgs = document.querySelectorAll('.reader-image img, .reader-images img, img.chapter-image, [class*="reader"] img, [class*="chapter"] img, img[src*="static.comix.to"], img[src*="/i/"]');
              const valid = Array.from(imgs)
                .map(img => img.src || img.getAttribute('data-src') || '')
                .filter(src => src && (src.includes('static.comix.to') || src.includes('/i/')) && !src.includes('avatar') && !src.includes('logo') && !src.includes('banner') && !src.includes('poster'));
              if (valid.length > 0) {
                window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(valid));
                return;
              }
              await new Promise(r => setTimeout(r, 300));
            }
            window.flutter_inappwebview.callHandler('setResponse', JSON.stringify([]));
          } catch(e) {
            window.flutter_inappwebview.callHandler('setResponse', 'ERROR:' + e.message);
          }
        })()
      `;
      const res = await evaluateJavascriptViaWebview(fullUrl, {}, [readerScript]);
      if (res && !res.startsWith("ERROR:")) {
        const pages = JSON.parse(res);
        if (Array.isArray(pages) && pages.length > 0) {
          return pages;
        }
      }
    } catch (_) {}

    try {
      const res = await this.client.get(fullUrl, this.headers);
      const doc = new Document(res.body || "");
      const imgs = doc.select(".reader-images img, img.chapter-image, img");
      const pages = [];
      for (let i = 0; i < imgs.length; i++) {
        let src = imgs[i].attr("src") || imgs[i].attr("data-src") || "";
        if (src && (src.includes("static.comix.to") || src.includes("/i/")) && !src.includes("logo") && !src.includes("avatar")) {
          pages.push(src);
        }
      }
      if (pages.length > 0) return pages;
    } catch (_) {}

    return [];
  }
}
