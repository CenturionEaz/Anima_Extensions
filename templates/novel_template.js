/**
 * Light Novel Extension Template for AnymeX & Mangayomi
 * itemType: 2 (Novel)
 */

const mangayomiSources = [
  {
    "name": "NovelExample",
    "id": 0, // 0 will auto-generate a unique deterministic ID
    "baseUrl": "https://examplenovel.com",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://examplenovel.com",
    "dateFormat": "MMMM dd, yyyy",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "", // Auto-filled on build
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": false,
    "itemType": 2, // 2 = Novel
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
    const url = `${this.source.baseUrl}/ranking?page=${page}`;
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const items = doc.select(".novel-item");
    
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
    const url = `${this.source.baseUrl}/latest?page=${page}`;
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const items = doc.select(".novel-item");
    
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
    const url = `${this.source.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const items = doc.select(".novel-item");
    
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

    const name = doc.selectFirst("h1, .novel-title")?.text?.trim() || "";
    const imageUrl = doc.selectFirst(".novel-cover img, .poster img")?.attr("src") || "";
    const description = doc.selectFirst(".synopsis, .description")?.text?.trim() || "";
    const author = doc.selectFirst(".author")?.text?.trim() || "";
    
    const genreEls = doc.select(".genres a");
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      const g = genreEls[i].text.trim();
      if (g) genre.push(g);
    }

    const chapterEls = doc.select(".chapter-list a");
    const chapters = [];
    for (let i = 0; i < chapterEls.length; i++) {
      const ch = chapterEls[i];
      const chName = ch.text.trim() || `Chapter ${i + 1}`;
      const chUrl = ch.attr("href") || "";
      if (chUrl) {
        chapters.push({
          name: chName,
          url: chUrl
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
      chapters
    };
  }

  async getPageList(url) {
    const targetUrl = url.startsWith("http") ? url : `${this.source.baseUrl}${url}`;
    const res = await this.client.get(targetUrl, this.headers);
    const doc = new Document(res.body || "");

    // For novels, getPageList returns chapter paragraphs or HTML lines
    const contentEl = doc.selectFirst("#chapter-content, .text-content, .entry-content");
    if (!contentEl) return [];

    const paragraphs = contentEl.select("p");
    const pages = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].text.trim();
      if (text) pages.push(text);
    }

    return pages.length > 0 ? pages : [contentEl.text.trim()];
  }
}
