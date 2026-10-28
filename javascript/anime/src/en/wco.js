/**
 * WCO (Watch Cartoon Online) Extension for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "WCO (WatchCartoonOnline)",
    "id": 85739102,
    "baseUrl": "https://www.wcostream.tv",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://www.wcostream.tv",
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
    "notes": "Uses active wcostream.tv mirror; requires Cloudflare WebView verification"
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
      "Referer": "https://www.wcostream.tv/"
    };
  }

  parseAnimeList(html) {
    const doc = new Document(html);
    const items = doc.select(".items li, .menustyle li, .ddmcc ul li");
    const list = [];

    for (let i = 0; i < items.length; i++) {
      const a = items[i].selectFirst("a");
      if (!a) continue;
      let link = a.attr("href") || "";
      if (!link) continue;
      if (!link.startsWith("http")) {
        link = `https://www.wcostream.tv${link.startsWith("/") ? "" : "/"}${link}`;
      }

      const name = a.text.trim();
      if (!name || name.length < 2) continue;

      const img = items[i].selectFirst("img");
      const imageUrl = img ? (img.attr("src") || img.attr("data-src") || "") : "";

      list.push({ name, link, imageUrl });
    }

    return { list, hasNextPage: false };
  }

  async getPopular(page) {
    const url = "https://www.wcostream.tv/subbed-anime-list";
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = "https://www.wcostream.tv/dubbed-anime-list";
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://www.wcostream.tv/search`;
    const res = await this.client.post(url, this.headers, { "catara": query });
    return this.parseAnimeList(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("#page h1, .video-title, h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".img5, #sidebar_right img, .video-content img");
    let imageUrl = imgEl ? (imgEl.attr("src") || "") : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `https://www.wcostream.tv${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    const descEl = doc.selectFirst("#content-box p, .description");
    const description = descEl ? descEl.text.trim() : "";

    const episodes = [];
    const epEls = doc.select("#sidebar_right2 ul li a, .menustyle li a, .list-group a");
    for (let i = 0; i < epEls.length; i++) {
      const a = epEls[i];
      let epUrl = a.attr("href") || "";
      if (!epUrl.startsWith("http")) {
        epUrl = `https://www.wcostream.tv${epUrl.startsWith("/") ? "" : "/"}${epUrl}`;
      }
      episodes.push({
        name: a.text.trim() || `Episode ${i + 1}`,
        url: epUrl
      });
    }

    return {
      name,
      imageUrl,
      description,
      author: "WCO",
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
      if (src && !src.includes("about:blank") && !src.includes("ads")) {
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
