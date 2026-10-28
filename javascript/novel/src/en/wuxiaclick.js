/**
 * WuxiaClick Extension for AnymeX & Mangayomi
 * itemType: 2 (Novel)
 */

const mangayomiSources = [
  {
    "name": "WuxiaClick",
    "id": 91823741,
    "baseUrl": "https://wuxia.click",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://wuxia.click",
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
      "Referer": "https://wuxia.click/"
    };
  }

  parseNovelCards(html) {
    const doc = new Document(html);
    // Find all links to /novel/...
    const anchors = doc.select('a[href^="/novel/"], a[href*="wuxia.click/novel/"]');
    const list = [];
    const seen = {};

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      let link = a.attr("href") || "";
      if (!link || link.includes("?") || link.includes("#")) continue;
      if (!link.startsWith("http")) {
        link = `https://wuxia.click${link.startsWith("/") ? "" : "/"}${link}`;
      }

      if (seen[link]) continue;
      seen[link] = true;

      const imgEl = a.selectFirst("img");
      let imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
      }

      // Title from text or h2/h3 or attr
      const titleEl = a.selectFirst("h2, h3, h4, span.font-medium, .title") || a;
      let name = (a.attr("title") || (titleEl ? titleEl.text : "")).trim();
      if (!name || name.length > 100 || name.startsWith("http")) continue;

      list.push({ name, link, imageUrl });
    }

    const nextEl = doc.selectFirst('a[rel="next"], a:contains("Next")');
    const hasNextPage = !!(nextEl && nextEl.attr("href"));

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = `https://wuxia.click/browse?sort=popular&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseNovelCards(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = `https://wuxia.click/browse?sort=latest&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseNovelCards(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://wuxia.click/browse?q=${q}&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseNovelCards(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst('img[src*="/covers/"], .cover-ph img, img');
    const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

    const descEl = doc.selectFirst(".description, .synopsis, p.leading-relaxed, .prose");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst('a[href*="/author/"], span:contains("Author") + span');
    const author = authorEl ? authorEl.text.trim() : "";

    const genreEls = doc.select('a[href*="/tag/"], a[href*="/genre/"]');
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    // Chapters
    const chapters = [];
    const chEls = doc.select('a[href*="/chapter/"]');
    const seenCh = {};

    for (let i = 0; i < chEls.length; i++) {
      const a = chEls[i];
      let chUrl = a.attr("href") || "";
      if (!chUrl || chUrl.includes("order=")) continue;
      if (!chUrl.startsWith("http")) {
        chUrl = `https://wuxia.click${chUrl.startsWith("/") ? "" : "/"}${chUrl}`;
      }

      if (seenCh[chUrl]) continue;
      seenCh[chUrl] = true;

      let chName = a.text.trim();
      if (!chName || chName.includes("Read first chapter") || chName.includes("Latest:")) continue;

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
    const contentEl = doc.selectFirst("#chapter-content, .reader-text, .reader-surface");
    if (!contentEl) return [];

    const pEls = contentEl.select("p");
    const list = [];
    for (let i = 0; i < pEls.length; i++) {
      const text = pEls[i].text.trim();
      if (text && !text.includes("WuxiaClick")) {
        list.push(text);
      }
    }

    return list.length > 0 ? list : [contentEl.text.trim()];
  }
}
