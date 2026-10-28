/**
 * AnimeKhor Extension for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "AnimeKhor",
    "id": 84729103,
    "baseUrl": "https://animekhor.org",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekhor.org",
    "dateFormat": "MMMM dd, yyyy",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.0",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.1.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1
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
      "Referer": "https://animekhor.org/"
    };
  }

  decodeBase64(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    str = String(str).replace(/=+$/, "");
    for (let bc = 0, bs = 0, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  }

  parseAnimeList(html) {
    const doc = new Document(html);
    const articles = doc.select("article.bs");
    const list = [];

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      const linkEl = art.selectFirst(".bsx a, a");
      if (!linkEl) continue;

      let link = linkEl.attr("href") || "";
      const name = (linkEl.attr("title") || linkEl.text || "").trim();
      if (!name) continue;

      const imgEl = art.selectFirst("img.ts-post-image, img");
      const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

      list.push({ name, link, imageUrl });
    }

    const nextEl = doc.selectFirst("a.next, .pagination .next, a[rel='next']");
    const hasNextPage = !!(nextEl && nextEl.attr("href"));

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = `https://animekhor.org/anime/?page=${page}&status=&type=&order=popular`;
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = `https://animekhor.org/anime/?page=${page}&status=&type=&order=update`;
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://animekhor.org/?s=${q}&post_type=anime`;
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h1.entry-title, .entry-title");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".thumb img, .bixbox img, img.ts-post-image");
    const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

    const descEl = doc.selectFirst(".entry-content, .synopsis, .desc");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst(".infox .spe:contains('Studio') span, .infox .spe:contains('Author')");
    const author = authorEl ? authorEl.text.trim() : "";

    const genreEls = doc.select(".genxed a, .mgen a");
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    const episodes = [];
    const epEls = doc.select(".eplister ul li a, .eplister a");
    for (let i = 0; i < epEls.length; i++) {
      const a = epEls[i];
      const epNumEl = a.selectFirst(".epl-num");
      const epTitleEl = a.selectFirst(".epl-title");
      const epDateEl = a.selectFirst(".epl-date");

      const epNum = epNumEl ? epNumEl.text.trim() : "";
      const epTitle = epTitleEl ? epTitleEl.text.trim() : "";
      const epName = epNum ? (epTitle ? `Episode ${epNum} - ${epTitle}` : `Episode ${epNum}`) : (a.text.trim() || `Episode ${i + 1}`);

      episodes.push({
        name: epName,
        url: a.attr("href") || "",
        dateUpload: epDateEl ? epDateEl.text.trim() : null
      });
    }

    return {
      name,
      imageUrl,
      description,
      author,
      genre,
      status: 0,
      episodes: episodes.reverse()
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const videos = [];

    // 1. Direct iframe player in page
    const iframeEl = doc.selectFirst(".player-embed iframe, iframe");
    if (iframeEl) {
      const src = iframeEl.attr("src") || "";
      if (src && !src.includes("about:blank")) {
        const fullSrc = src.startsWith("//") ? `https:${src}` : src;
        videos.push({
          url: fullSrc,
          originalUrl: fullSrc,
          quality: "Default Player"
        });
      }
    }

    // 2. Mirrors in select dropdown with base64 encoded iframes
    const options = doc.select("select.mirror option");
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const val = opt.attr("value") || "";
      const label = opt.text.trim();
      if (!val || val === "") continue;

      try {
        const decoded = this.decodeBase64(val);
        const match = decoded.match(/src=["']([^"']+)["']/);
        if (match && match[1]) {
          let embedUrl = match[1];
          if (embedUrl.startsWith("//")) embedUrl = `https:${embedUrl}`;
          videos.push({
            url: embedUrl,
            originalUrl: embedUrl,
            quality: label || `Server ${i}`
          });
        }
      } catch (_) {}
    }

    return videos;
  }
}
