/**
 * Atsumaru (atsu.moe) Extension for AnymeX & Mangayomi
 * itemType: 0 (Manga)
 */

const mangayomiSources = [
  {
    "name": "Atsumaru",
    "id": 51928401,
    "baseUrl": "https://atsu.moe",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://atsu.moe",
    "dateFormat": "yyyy-MM-dd",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "https://atsu.moe",
    "version": "0.1.0",
    "isManga": true,
    "itemType": 0,
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
      "Referer": "https://atsu.moe/"
    };
  }

  getImageUrl(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const clean = path.startsWith("/") ? path : `/${path}`;
    return `https://atsu.moe${clean}`;
  }

  async getPopular(page) {
    if (parseInt(page) === 1) {
      try {
        const res = await this.client.get("https://atsu.moe/api/home2/popular", this.headers);
        const data = JSON.parse(res.body);
        const items = Array.isArray(data) ? data : (data.popular || []);
        const list = items.map(item => ({
          name: item.title || "",
          link: item.id || "",
          imageUrl: this.getImageUrl(item.largeImage || item.image || item.mediumImage || item.smallImage)
        }));
        return { list, hasNextPage: true };
      } catch (_) {}
    }

    const url = `https://atsu.moe/collections/manga/documents/search?q=*&query_by=title&sort_by=views:desc&page=${page}&per_page=24`;
    const res = await this.client.get(url, this.headers);
    const data = JSON.parse(res.body);
    const hits = data.hits || [];
    const list = hits.map(h => {
      const doc = h.document || {};
      return {
        name: doc.title || "",
        link: doc.id || "",
        imageUrl: this.getImageUrl(doc.largeImage || doc.image || doc.poster)
      };
    });

    return {
      list,
      hasNextPage: (data.found || 0) > parseInt(page) * 24
    };
  }

  async getLatestUpdates(page) {
    const url = `https://atsu.moe/collections/manga/documents/search?q=*&query_by=title&sort_by=updatedAt:desc&page=${page}&per_page=24`;
    const res = await this.client.get(url, this.headers);
    const data = JSON.parse(res.body);
    const hits = data.hits || [];
    const list = hits.map(h => {
      const doc = h.document || {};
      return {
        name: doc.title || "",
        link: doc.id || "",
        imageUrl: this.getImageUrl(doc.largeImage || doc.image || doc.poster)
      };
    });

    return {
      list,
      hasNextPage: (data.found || 0) > parseInt(page) * 24
    };
  }

  async search(query, page, filters) {
    const q = query ? encodeURIComponent(query.trim()) : "*";
    const url = `https://atsu.moe/collections/manga/documents/search?q=${q}&query_by=title&page=${page}&per_page=24`;
    const res = await this.client.get(url, this.headers);
    const data = JSON.parse(res.body);
    const hits = data.hits || [];
    const list = hits.map(h => {
      const doc = h.document || {};
      return {
        name: doc.title || "",
        link: doc.id || "",
        imageUrl: this.getImageUrl(doc.largeImage || doc.image || doc.poster)
      };
    });

    return {
      list,
      hasNextPage: (data.found || 0) > parseInt(page) * 24
    };
  }

  async getDetail(url) {
    const mangaId = url.replace(/^.*\/([^\/\?#]+)$/, "$1");
    const apiUrl = `https://atsu.moe/api/manga/page?id=${mangaId}`;
    const res = await this.client.get(apiUrl, this.headers);
    const data = JSON.parse(res.body);
    const page = data.mangaPage || {};

    const rawChapters = page.chapters || [];
    const chapters = rawChapters.map(ch => ({
      name: ch.title ? (ch.title.startsWith("Chapter") ? ch.title : `Ch. ${ch.number || ""} ${ch.title}`.trim()) : `Chapter ${ch.number || ""}`.trim(),
      url: `${mangaId}___${ch.id}`,
      dateUpload: ch.createdAt ? ch.createdAt.toString() : null,
      scanlator: ch.scanlationMangaId || ""
    }));

    return {
      name: page.title || "",
      imageUrl: this.getImageUrl(page.poster || page.banner || ""),
      description: page.synopsis || "",
      author: (page.authors || []).join(", "),
      genre: page.genres || [],
      status: page.status === "Ongoing" ? 0 : (page.status === "Completed" ? 1 : 5),
      chapters
    };
  }

  async getPageList(url) {
    const parts = url.split("___");
    if (parts.length < 2) return [];
    const mangaId = parts[0];
    const chapterId = parts[1];

    const apiUrl = `https://atsu.moe/api/read/chapter?mangaId=${mangaId}&chapterId=${chapterId}`;
    const res = await this.client.get(apiUrl, this.headers);
    const data = JSON.parse(res.body);
    const rc = data.readChapter || {};
    const pages = rc.pages || [];

    return pages.map(p => this.getImageUrl(p.image));
  }
}
