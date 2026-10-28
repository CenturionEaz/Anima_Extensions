/**
 * Toonkotsu Extension for AnymeX & Mangayomi
 * itemType: 0 (Manga)
 */

const mangayomiSources = [
  {
    "name": "Toonkotsu",
    "id": 52918342,
    "baseUrl": "https://toonkotsu.com",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://toonkotsu.com",
    "dateFormat": "MMM dd, yyyy",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.3",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.1.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "Requires Cloudflare WebView verification"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://toonkotsu.com/"
    };
  }

  parseCards(html) {
    const doc = new Document(html);
    const anchors = doc.select('a[href^="/title/"]');
    const list = [];
    const seen = {};

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      let link = a.attr("href") || "";
      if (!link || link.includes("/chapter/") || link.includes("-chapter-") || link === "/title/random") continue;
      if (!link.startsWith("http")) {
        link = `https://toonkotsu.com${link.startsWith("/") ? "" : "/"}${link}`;
      }

      if (seen[link]) continue;
      seen[link] = true;

      const name = (a.attr("title") || a.text || "").trim();
      if (!name || name.length > 80 || name === "Home") continue;

      const imgEl = a.selectFirst("img");
      let imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `https://toonkotsu.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
        }
      }

      list.push({ name, link, imageUrl });
    }

    return { list, hasNextPage: false };
  }

  async getPopular(page) {
    const url = "https://toonkotsu.com/";
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = "https://toonkotsu.com/updates";
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://toonkotsu.com/search?q=${q}`;
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h1");
    let name = titleEl ? titleEl.text.trim() : "";
    if (name.includes("—")) {
      name = name.split("—")[0].trim();
    }

    const imgEl = doc.selectFirst("img.ui-cover, .cover img, img");
    let imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `https://toonkotsu.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    const descEl = doc.selectFirst("p.ui-description, .description, p");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst('a[href^="/author/"]');
    const author = authorEl ? authorEl.text.trim() : "";

    const genreEls = doc.select('a[href^="/tag/"]');
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    const chapters = [];
    const chEls = doc.select('a[href*="-chapter-"]');
    const seen = {};

    for (let i = 0; i < chEls.length; i++) {
      const a = chEls[i];
      let chUrl = a.attr("href") || "";
      if (!chUrl.startsWith("http")) {
        chUrl = `https://toonkotsu.com${chUrl.startsWith("/") ? "" : "/"}${chUrl}`;
      }

      if (seen[chUrl]) continue;
      seen[chUrl] = true;

      const chName = a.text.trim();
      if (!chName) continue;

      chapters.push({
        name: chName,
        url: chUrl
      });
    }

    return {
      name,
      imageUrl,
      description,
      author,
      genre,
      status: 0,
      chapters
    };
  }

  async getPageList(url) {
    let fullUrl = url;
    if (!fullUrl.startsWith("http")) {
      fullUrl = `https://toonkotsu.com${fullUrl.startsWith("/") ? "" : "/"}${fullUrl}`;
    }

    // 1. Try webview fetch within Cloudflare session
    try {
      const readerScript = `
        (async function() {
          try {
            const m = window.location.pathname.match(/\\/(\\d+)(?:-chapter-[^\\/]*)?$/) || window.location.pathname.match(/\\/(\\d+)/);
            if (m) {
              const res = await fetch('/api/manga/chapter/' + m[1]);
              const data = await res.json();
              const chPages = (data.chapter && data.chapter.pages) || data.pages || [];
              if (Array.isArray(chPages) && chPages.length > 0) {
                const list = chPages.map(p => {
                  const src = typeof p === 'string' ? p : (p.src || p.url || '');
                  return src.startsWith('http') ? src : 'https://toonkotsu.com' + (src.startsWith('/') ? '' : '/') + src;
                });
                window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(list));
                return;
              }
            }
          } catch(e) {}
          try {
            for (let i = 0; i < 25; i++) {
              const imgs = document.querySelectorAll('.reader-images img, #reader img, img.ui-page, .reader-page-clip img, .reader-page img, article img');
              const valid = Array.from(imgs)
                .map(img => img.src || img.getAttribute('data-src') || '')
                .filter(src => src && !src.includes('cover') && !src.includes('logo') && !src.includes('avatar'));
              if (valid.length > 0) {
                window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(valid));
                return;
              }
              await new Promise(r => setTimeout(r, 200));
            }
            window.flutter_inappwebview.callHandler('setResponse', JSON.stringify([]));
          } catch(e) {
            window.flutter_inappwebview.callHandler('setResponse', 'ERROR:' + e.message);
          }
        })()
      `;
      const resStr = await evaluateJavascriptViaWebview(fullUrl, {}, [readerScript]);
      if (resStr && !resStr.startsWith("ERROR:")) {
        const pages = JSON.parse(resStr);
        if (Array.isArray(pages) && pages.length > 0) {
          return pages.map(u => ({
            url: u,
            headers: {
              "Referer": "https://toonkotsu.com/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          }));
        }
      }
    } catch (_) {}

    // 2. Direct API call fallback
    let chapterId = "";
    const m = url.match(/\/(\d+)(?:-chapter-[^\/]*)?$/) || url.match(/\/(\d+)/);
    if (m) chapterId = m[1];

    if (chapterId) {
      try {
        const apiUrl = `https://toonkotsu.com/api/manga/chapter/${chapterId}`;
        const res = await this.client.get(apiUrl, this.headers);
        if (res && res.body) {
          const data = JSON.parse(res.body);
          const chPages = (data.chapter && data.chapter.pages) || data.pages || [];
          if (chPages.length > 0) {
            return chPages.map(p => {
              const src = typeof p === "string" ? p : (p.src || p.url || "");
              const full = src.startsWith("http") ? src : `https://toonkotsu.com${src.startsWith("/") ? "" : "/"}${src}`;
              return {
                url: full,
                headers: {
                  "Referer": "https://toonkotsu.com/",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
              };
            });
          }
        }
      } catch (_) {}
    }

    // 3. Document fallback
    try {
      const res = await this.client.get(fullUrl, this.headers);
      const doc = new Document(res.body || "");
      const imgs = doc.select(".reader-images img, #reader img, img.ui-page, .reader-page-clip img, .reader-page img, article img");
      const pages = [];

      for (let i = 0; i < imgs.length; i++) {
        let src = imgs[i].attr("src") || imgs[i].attr("data-src") || "";
        if (src && !src.includes("cover") && !src.includes("logo") && !src.includes("avatar")) {
          const full = src.startsWith("http") ? src : `https://toonkotsu.com${src.startsWith("/") ? "" : "/"}${src}`;
          pages.push({
            url: full,
            headers: {
              "Referer": "https://toonkotsu.com/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          });
        }
      }
      if (pages.length > 0) return pages;
    } catch (_) {}

    return [];
  }
}
