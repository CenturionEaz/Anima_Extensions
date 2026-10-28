/**
 * ReadNovelFull Extension for AnymeX & Mangayomi
 * itemType: 2 (Novel)
 */

const mangayomiSources = [
  {
    "name": "ReadNovelFull",
    "id": 89201452,
    "baseUrl": "https://readnovelfull.com",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://readnovelfull.com",
    "dateFormat": "MMM dd, yyyy",
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
      "Referer": "https://readnovelfull.com/"
    };
  }

  parseBooks(html) {
    const doc = new Document(html);
    const rows = doc.select(".list-novel .row, .col-novel-main .row");
    const list = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const titleEl = row.selectFirst("h3.novel-title a, .col-title h3 a");
      if (!titleEl) continue;
      const name = titleEl.text.trim();
      let link = titleEl.attr("href") || "";
      if (link && !link.startsWith("http")) {
        link = `https://readnovelfull.com${link.startsWith("/") ? "" : "/"}${link}`;
      }

      const imgEl = row.selectFirst("img.cover, img");
      let imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `https://readnovelfull.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
        }
      }

      list.push({ name, link, imageUrl });
    }

    const nextEl = doc.selectFirst("li.next a, ul.pagination li:last-child a");
    const hasNextPage = !!(nextEl && nextEl.attr("href") && nextEl.attr("href") !== "#");

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = `https://readnovelfull.com/novel-list/most-popular-novel?page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseBooks(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = `https://readnovelfull.com/novel-list/latest-release-novel?page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseBooks(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://readnovelfull.com/search?keyword=${q}&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseBooks(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h3.title, h1.title, .novel-title");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".book img, .cover img");
    let imageUrl = "";
    if (imgEl) {
      imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = `https://readnovelfull.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
      }
    }

    const descEl = doc.selectFirst(".desc-text, .panel-body");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst('.info a[href*="/author/"], .info a[href*="/a/"]');
    const author = authorEl ? authorEl.text.trim() : "";

    const genreEls = doc.select('.info a[href*="/genre/"]');
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    // Chapters from ajax endpoint
    const chapters = [];
    const novelIdEl = doc.selectFirst("[data-novel-id], #rating[data-novel-id]");
    const novelId = novelIdEl ? novelIdEl.attr("data-novel-id") : "";

    if (novelId) {
      const ajaxUrl = `https://readnovelfull.com/ajax/chapter-archive?novelId=${novelId}`;
      const ajaxRes = await this.client.get(ajaxUrl, this.headers);
      const ajaxDoc = new Document(ajaxRes.body || "");
      const chEls = ajaxDoc.select("ul.list-chapter li a, .list-chapter a");
      for (let i = 0; i < chEls.length; i++) {
        const a = chEls[i];
        let chUrl = a.attr("href") || "";
        if (chUrl && !chUrl.startsWith("http")) {
          chUrl = `https://readnovelfull.com${chUrl.startsWith("/") ? "" : "/"}${chUrl}`;
        }
        chapters.push({
          name: (a.attr("title") || a.text || "").trim(),
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
      status: 0,
      chapters
    };
  }

  async getPageList(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const contentEl = doc.selectFirst("#chr-content, .chapter-c, .chr-c");
    if (!contentEl) return [];

    const pEls = contentEl.select("p");
    const list = [];
    for (let i = 0; i < pEls.length; i++) {
      const text = pEls[i].text.trim();
      if (text && !text.includes("readnovelfull.com")) {
        list.push(text);
      }
    }

    return list.length > 0 ? list : [contentEl.text.trim()];
  }
}
