/**
 * Kartoons Extension (kartoons.to) for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "Kartoons",
    "id": 87401928,
    "baseUrl": "https://kartoons.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://kartoons.to",
    "dateFormat": "yyyy-MM-dd",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.0",
    "isManga": false,
    "itemType": 1,
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
      "Referer": "https://kartoons.to/"
    };
  }

  parseCards(html) {
    const doc = new Document(html);
    const anchors = doc.select('a[href*="/show/"], a[href*="/series/"], a[href*="/movie/"], a[href*="/watch/"]');
    const list = [];
    const seen = {};

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      let link = a.attr("href") || "";
      if (!link) continue;
      if (!link.startsWith("http")) {
        link = `https://kartoons.to${link.startsWith("/") ? "" : "/"}${link}`;
      }

      if (seen[link]) continue;
      seen[link] = true;

      const imgEl = a.selectFirst("img");
      const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

      const titleEl = a.selectFirst("h3, h4, span.title, .title") || a;
      let name = (a.attr("title") || (titleEl ? titleEl.text : "")).trim();
      if (!name || name.length > 80) continue;

      list.push({ name, link, imageUrl });
    }

    return { list, hasNextPage: false };
  }

  async getPopular(page) {
    const url = "https://kartoons.to/";
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = "https://kartoons.to/";
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://kartoons.to/search?q=${q}`;
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".poster img, img");
    let imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `https://kartoons.to${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    const descEl = doc.selectFirst(".description, .synopsis, p");
    const description = descEl ? descEl.text.trim() : "";

    const episodes = [];
    const epEls = doc.select('a[href*="/watch/"], a[href*="/episode/"]');
    const seen = {};

    for (let i = 0; i < epEls.length; i++) {
      const a = epEls[i];
      let epUrl = a.attr("href") || "";
      if (!epUrl.startsWith("http")) {
        epUrl = `https://kartoons.to${epUrl.startsWith("/") ? "" : "/"}${epUrl}`;
      }

      if (seen[epUrl]) continue;
      seen[epUrl] = true;

      episodes.push({
        name: a.text.trim() || `Episode ${i + 1}`,
        url: epUrl
      });
    }

    return {
      name,
      imageUrl,
      description,
      author: "Kartoons",
      genre: [],
      status: 0,
      episodes: episodes.reverse()
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const videos = [];

    const iframes = doc.select("iframe");
    for (let i = 0; i < iframes.length; i++) {
      let src = iframes[i].attr("src") || "";
      if (src && !src.includes("about:blank") && !src.includes("challenges.cloudflare")) {
        if (src.startsWith("//")) src = `https:${src}`;
        videos.push({
          url: src,
          originalUrl: src,
          quality: `Server ${i + 1}`
        });
      }
    }

    return videos;
  }
}
