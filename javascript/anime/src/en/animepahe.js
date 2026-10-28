/**
 * AnimePahe Extension for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "AnimePahe",
    "id": 85192044,
    "baseUrl": "https://animepahe.pw",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animepahe.pw",
    "dateFormat": "yyyy-MM-dd",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "",
    "apiUrl": "https://animepahe.pw/api",
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
      "Referer": "https://animepahe.pw/"
    };
  }

  async getPopular(page) {
    const url = `https://animepahe.pw/api?m=airing&page=${page}`;
    try {
      const res = await this.client.get(url, this.headers);
      const data = JSON.parse(res.body);
      const items = data.data || [];
      const list = items.map(item => ({
        name: item.anime_title || item.title || "",
        link: `https://animepahe.pw/anime/${item.anime_session || item.session}`,
        imageUrl: item.snapshot || item.poster || ""
      }));
      return {
        list,
        hasNextPage: (data.current_page || 1) < (data.last_page || 1)
      };
    } catch (_) {
      // Fallback to HTML scraping
      const res = await this.client.get("https://animepahe.pw/", this.headers);
      const doc = new Document(res.body || "");
      const items = doc.select(".latest-release .col-12, .airing-list .col-12");
      const list = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const a = item.selectFirst("a");
        const img = item.selectFirst("img");
        if (!a) continue;
        list.push({
          name: (a.attr("title") || a.text || "").trim(),
          link: a.attr("href") || "",
          imageUrl: img ? (img.attr("src") || img.attr("data-src") || "") : ""
        });
      }
      return { list, hasNextPage: false };
    }
  }

  async getLatestUpdates(page) {
    return await this.getPopular(page);
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://animepahe.pw/api?m=search&q=${q}`;
    const res = await this.client.get(url, this.headers);
    const data = JSON.parse(res.body);
    const items = data.data || [];
    const list = items.map(item => ({
      name: item.title || "",
      link: `https://animepahe.pw/anime/${item.session}`,
      imageUrl: item.poster || ""
    }));

    return { list, hasNextPage: false };
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst(".title-wrapper h1, h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".anime-poster img, .poster img");
    const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

    const descEl = doc.selectFirst(".anime-summary, .summary");
    const description = descEl ? descEl.text.trim() : "";

    const episodes = [];
    // Extract anime session ID from URL or page
    const sessionMatch = url.match(/\/anime\/([a-zA-Z0-9_\-]+)/);
    const animeSession = sessionMatch ? sessionMatch[1] : "";

    if (animeSession) {
      try {
        const epApi = `https://animepahe.pw/api?m=release&id=${animeSession}&sort=episode_asc&page=1`;
        const epRes = await this.client.get(epApi, this.headers);
        const epData = JSON.parse(epRes.body);
        const epItems = epData.data || [];
        for (let i = 0; i < epItems.length; i++) {
          const ep = epItems[i];
          episodes.push({
            name: `Episode ${ep.episode}`,
            url: `https://animepahe.pw/play/${animeSession}/${ep.session}`,
            dateUpload: ep.created_at || null
          });
        }
      } catch (_) {}
    }

    return {
      name,
      imageUrl,
      description,
      author: "",
      genre: [],
      status: 0,
      episodes
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const videos = [];

    // Dropdown / buttons for download or play servers
    const links = doc.select("#pickDownload a, #resolutionMenu button, a[href*='kwik']");
    for (let i = 0; i < links.length; i++) {
      const el = links[i];
      let href = el.attr("href") || el.attr("data-src") || "";
      const text = el.text.trim();
      if (href) {
        videos.push({
          url: href,
          originalUrl: href,
          quality: text || `Server ${i + 1}`
        });
      }
    }

    return videos;
  }
}
