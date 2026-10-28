/**
 * Onisaga Extension for AnymeX & Mangayomi
 * itemType: 0 (Manga)
 */

const mangayomiSources = [
  {
    "name": "Onisaga",
    "id": 53819204,
    "baseUrl": "https://onisaga.com",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://onisaga.com",
    "dateFormat": "MMMM dd, yyyy",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.1",
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
      "Referer": "https://onisaga.com/"
    };
  }

  parseManga(html) {
    const doc = new Document(html);
    const items = doc.select(".page-item-detail, .manga, .bsx, .slider__item, article");
    const list = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const linkEl = item.selectFirst(".post-title a, h3 a, h5 a, .thumb a, a");
      if (!linkEl) continue;
      let link = linkEl.attr("href") || "";
      if (!link || link === "https://onisaga.com/" || link.includes("/chapter/")) continue;
      if (!link.startsWith("http")) {
        link = `https://onisaga.com${link.startsWith("/") ? "" : "/"}${link}`;
      }

      const name = (linkEl.text || linkEl.attr("title") || "").trim();
      if (!name) continue;

      const imgEl = item.selectFirst("img");
      let imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `https://onisaga.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
        }
      }

      list.push({ name, link, imageUrl });
    }

    const nextEl = doc.selectFirst(".nav-previous a, a.next, .pagination .next");
    const hasNextPage = !!(nextEl && nextEl.attr("href"));

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = `https://onisaga.com/manga/?m_orderby=views&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseManga(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = `https://onisaga.com/manga/?m_orderby=latest&page=${page}`;
    const res = await this.client.get(url, this.headers);
    return this.parseManga(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://onisaga.com/?s=${q}&post_type=wp-manga`;
    const res = await this.client.get(url, this.headers);
    return this.parseManga(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst(".post-title h1, h1.entry-title, h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".summary_image img, .thumb img, img");
    let imageUrl = imgEl ? (imgEl.attr("data-src") || imgEl.attr("src") || "") : "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `https://onisaga.com${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }

    const descEl = doc.selectFirst(".description-summary, .summary__content, .entry-content");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst(".author-content a, .artist-content a");
    const author = authorEl ? authorEl.text.trim() : "";

    const genreEls = doc.select(".genres-content a");
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    let chapters = [];
    let chEls = doc.select("li.wp-manga-chapter a, .chapter-link a, .eplister a, .listing-chapters_wrap a");

    // If static HTML had no chapters, try Madara AJAX chapters endpoint
    if (chEls.length === 0) {
      try {
        const cleanUrl = url.replace(/\/+$/, "");
        const ajaxRes = await this.client.get(`${cleanUrl}/ajax/chapters/`, this.headers);
        if (ajaxRes && ajaxRes.body) {
          const ajaxDoc = new Document(ajaxRes.body);
          chEls = ajaxDoc.select("li.wp-manga-chapter a, .chapter-link a, a");
        }
      } catch (_) {}
    }

    const seenUrls = {};
    for (let i = 0; i < chEls.length; i++) {
      const a = chEls[i];
      let chUrl = a.attr("href") || "";
      if (!chUrl || chUrl === "#" || chUrl.includes("javascript:")) continue;
      if (!chUrl.startsWith("http")) {
        chUrl = `https://onisaga.com${chUrl.startsWith("/") ? "" : "/"}${chUrl}`;
      }

      if (seenUrls[chUrl]) continue;
      seenUrls[chUrl] = true;

      chapters.push({
        name: a.text.trim() || `Chapter ${i + 1}`,
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
    const imgs = doc.select(".reading-content img, .page-break img, .wp-manga-chapter-img, .entry-content img");
    const pages = [];
    const seen = {};

    for (let i = 0; i < imgs.length; i++) {
      let src = imgs[i].attr("data-src") || imgs[i].attr("data-lazy-src") || imgs[i].attr("data-full-url") || imgs[i].attr("src") || "";
      src = src.trim();
      if (src && !src.includes("logo") && !src.includes("banner") && !src.includes("icon")) {
        if (!src.startsWith("http")) {
          src = `https://onisaga.com${src.startsWith("/") ? "" : "/"}${src}`;
        }
        if (!seen[src]) {
          seen[src] = true;
          pages.push(src);
        }
      }
    }

    return pages;
  }
}
