/**
 * Anime Extension Template for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "AnimeExample",
    "id": 0, // 0 will auto-generate a unique deterministic ID
    "baseUrl": "https://exampleanime.tv",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://exampleanime.tv",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "", // Auto-filled on build
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": false,
    "itemType": 1, // 1 = Anime
    "isFullData": false,
    "appMinVerReq": "0.1.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1 // 1 = JavaScript
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
      "Referer": this.source.baseUrl + "/"
    };
  }

  async getPopular(page) {
    const url = `${this.source.baseUrl}/popular?page=${page}`;
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const items = doc.select(".anime-item");
    
    const list = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleEl = item.selectFirst(".title, a.name");
      const imgEl = item.selectFirst("img");
      const linkEl = item.selectFirst("a");
      if (!titleEl || !linkEl) continue;

      list.push({
        name: titleEl.text.trim(),
        link: linkEl.attr("href") || "",
        imageUrl: imgEl ? (imgEl.attr("data-src") || imgEl.attr("src") || "") : ""
      });
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) {
    const url = `${this.source.baseUrl}/recently-updated?page=${page}`;
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const items = doc.select(".anime-item");
    
    const list = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleEl = item.selectFirst(".title, a.name");
      const imgEl = item.selectFirst("img");
      const linkEl = item.selectFirst("a");
      if (!titleEl || !linkEl) continue;

      list.push({
        name: titleEl.text.trim(),
        link: linkEl.attr("href") || "",
        imageUrl: imgEl ? (imgEl.attr("data-src") || imgEl.attr("src") || "") : ""
      });
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async search(query, page, filters) {
    const url = `${this.source.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`;
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const items = doc.select(".anime-item");
    
    const list = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleEl = item.selectFirst(".title, a.name");
      const imgEl = item.selectFirst("img");
      const linkEl = item.selectFirst("a");
      if (!titleEl || !linkEl) continue;

      list.push({
        name: titleEl.text.trim(),
        link: linkEl.attr("href") || "",
        imageUrl: imgEl ? (imgEl.attr("data-src") || imgEl.attr("src") || "") : ""
      });
    }

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getDetail(url) {
    const targetUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
    const res = await this.client.get(targetUrl, this.headers);
    const doc = new Document(res.body || "");

    const name = doc.selectFirst("h1, .anime-title")?.text?.trim() || "";
    const imageUrl = doc.selectFirst(".poster img, .anime-cover img")?.attr("src") || "";
    const description = doc.selectFirst(".synopsis, .description")?.text?.trim() || "";
    const author = doc.selectFirst(".studio, .author")?.text?.trim() || "";
    
    const genreEls = doc.select(".genres a, .genre-item");
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      const g = genreEls[i].text.trim();
      if (g) genre.push(g);
    }

    // Episodes mapped to chapters list
    const epEls = doc.select(".episode-list a, ul.episodes li a");
    const chapters = [];
    for (let i = 0; i < epEls.length; i++) {
      const ep = epEls[i];
      const epName = ep.text.trim() || `Episode ${i + 1}`;
      const epUrl = ep.attr("href") || "";
      if (epUrl) {
        chapters.push({
          name: epName,
          url: epUrl,
          scanlator: "Sub"
        });
      }
    }

    return {
      name,
      imageUrl,
      description,
      author,
      genre,
      status: 0, // 0: Ongoing, 1: Completed, 4: Upcoming, 5: Unknown
      link: targetUrl,
      chapters: chapters.reverse() // Newest first
    };
  }

  async getVideoList(url) {
    const targetUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
    const res = await this.client.get(targetUrl, this.headers);
    const doc = new Document(res.body || "");

    // Example extractor logic:
    // Extract iframe src, mp4/m3u8 link, or AJAX stream endpoint
    const iframe = doc.selectFirst("iframe");
    const embedUrl = iframe ? iframe.attr("src") : "";

    const videos = [];
    if (embedUrl) {
      videos.push({
        url: embedUrl,
        originalUrl: embedUrl,
        quality: "Default",
        headers: {
          "Referer": this.source.baseUrl + "/"
        },
        subtitles: []
      });
    }

    return videos;
  }
}
