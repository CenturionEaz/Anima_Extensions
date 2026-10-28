/**
 * NovelCool Extension for AnymeX & Mangayomi
 * itemType: 2 (Novel)
 */

const mangayomiSources = [
  {
    "name": "NovelCool",
    "id": 92384719,
    "baseUrl": "https://www.novelcool.com",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://www.novelcool.com",
    "dateFormat": "yyyy-MM-dd",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.0",
    "isManga": false,
    "itemType": 2,
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
      "Referer": "https://www.novelcool.com/"
    };
  }

  parseBooks(html) {
    const doc = new Document(html);
    const items = doc.select(".book-item");
    const list = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const linkEl = item.selectFirst("a.book-pic, a.book-title, a");
      if (!linkEl) continue;
      let link = linkEl.attr("href") || "";
      if (!link.startsWith("http")) {
        link = `https://www.novelcool.com${link.startsWith("/") ? "" : "/"}${link}`;
      }

      const titleEl = item.selectFirst(".book-title, a.book-pic, a");
      const name = (titleEl ? (titleEl.attr("title") || titleEl.text) : "").trim();
      if (!name) continue;

      const imgEl = item.selectFirst("img");
      let imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("data-src") || imgEl.attr("src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `https://www.novelcool.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
        }
      }

      list.push({ name, link, imageUrl });
    }

    const nextEl = doc.selectFirst('a.page-item-next, a[rel="next"]');
    const hasNextPage = !!(nextEl && nextEl.attr("href"));

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = `https://www.novelcool.com/category/popular.html?page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseBooks(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = `https://www.novelcool.com/category/latest.html?page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseBooks(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://www.novelcool.com/search?name=${q}&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseBooks(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst(".book-info h1, .book-name, h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".book-pic img, .book-cover img, img");
    let imageUrl = "";
    if (imgEl) {
      imageUrl = imgEl.attr("data-src") || imgEl.attr("src") || "";
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = `https://www.novelcool.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
      }
    }

    const descEl = doc.selectFirst(".book-info-desc, .book-summary, .book-desc");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst('.book-author a, a[href*="/author/"]');
    const author = authorEl ? authorEl.text.trim() : "";

    const genreEls = doc.select('.book-genre a, a[href*="/category/"]');
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    // Chapters
    const chEls = doc.select('a[href*="/chapter/"]');
    const chapters = [];
    const seen = {};

    for (let i = 0; i < chEls.length; i++) {
      const a = chEls[i];
      let chUrl = a.attr("href") || "";
      if (!chUrl.startsWith("http")) {
        chUrl = `https://www.novelcool.com${chUrl.startsWith("/") ? "" : "/"}${chUrl}`;
      }

      if (seen[chUrl]) continue;
      seen[chUrl] = true;

      const chName = (a.attr("title") || a.text || "").trim();
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
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const contentEl = doc.selectFirst(".chapter-reading-section, .chapter-section, .reading-content, .chapter-content");
    if (!contentEl) return [];

    const pEls = contentEl.select("p");
    const list = [];
    for (let i = 0; i < pEls.length; i++) {
      const text = pEls[i].text.trim();
      if (text && !text.includes("novelcool.com")) {
        list.push(text);
      }
    }

    return list.length > 0 ? list : [contentEl.text.trim()];
  }
}
