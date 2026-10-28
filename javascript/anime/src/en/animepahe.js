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
    "version": "0.1.2",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.1.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "Direct HLS Stream Extractor with Kwik Unpacker"
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

  baseN(val, radix) {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (val === 0) return "0";
    let res = "";
    while (val > 0) {
      res = chars[val % radix] + res;
      val = Math.floor(val / radix);
    }
    return res;
  }

  unpackJs(packed) {
    const m = packed.match(/}\s*\(\s*(['"][\s\S]*?['"])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"][\s\S]*?['"])\.split\('\|'\)/);
    if (!m) return packed;
    let p = m[1].slice(1, -1);
    const a = parseInt(m[2], 10);
    let c = parseInt(m[3], 10);
    const k = m[4].slice(1, -1).split("|");
    while (c--) {
      if (k[c]) {
        const key = this.baseN(c, a);
        const reg = new RegExp("\\b" + key + "\\b", "g");
        p = p.replace(reg, k[c]);
      }
    }
    return p;
  }

  async extractKwik(kwikUrl, referer) {
    try {
      const res = await this.client.get(kwikUrl, {
        "User-Agent": this.headers["User-Agent"],
        "Referer": referer || "https://animepahe.pw/"
      });
      const html = res.body || "";

      // 1. Check for Dean Edwards packed script
      const scriptMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)\)\)/);
      if (scriptMatch) {
        const unpacked = this.unpackJs(scriptMatch[0]);
        const srcMatch = unpacked.match(/const\s+source\s*=\s*['"]([^'"]+)['"]/i) ||
                         unpacked.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (srcMatch && srcMatch[1]) {
          return srcMatch[1];
        }
      }

      // 2. Direct regex match in HTML
      const directMatch = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
      if (directMatch && directMatch[1]) {
        return directMatch[1];
      }
    } catch (_) {}
    return null;
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
    const sessionMatch = url.match(/\/anime\/([a-zA-Z0-9_\-]+)/);
    const animeSession = sessionMatch ? sessionMatch[1] : "";

    if (animeSession) {
      try {
        let page = 1;
        let lastPage = 1;
        do {
          const epApi = `https://animepahe.pw/api?m=release&id=${animeSession}&sort=episode_asc&page=${page}`;
          const epRes = await this.client.get(epApi, this.headers);
          const epData = JSON.parse(epRes.body);
          lastPage = epData.last_page || 1;
          const epItems = epData.data || [];
          for (let i = 0; i < epItems.length; i++) {
            const ep = epItems[i];
            episodes.push({
              name: `Episode ${ep.episode}`,
              url: `https://animepahe.pw/play/${animeSession}/${ep.session}`,
              dateUpload: ep.created_at || null
            });
          }
          page++;
        } while (page <= lastPage && page <= 10);
      } catch (_) {}
    }

    return {
      name,
      imageUrl,
      description,
      author: "",
      genre: [],
      status: 0,
      episodes: episodes.reverse()
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const videos = [];

    // Dropdown / buttons for download or play servers
    const links = doc.select("#resolutionMenu button, #pickDownload a, iframe[src*='kwik'], a[href*='kwik']");
    for (let i = 0; i < links.length; i++) {
      const el = links[i];
      let href = el.attr("data-src") || el.attr("href") || el.attr("src") || "";
      if (!href) continue;
      if (href.startsWith("//")) href = `https:${href}`;

      const resLabel = el.attr("data-resolution") || "";
      const fansubLabel = el.attr("data-fansub") || "";
      const audioLabel = el.attr("data-audio") || "";
      let quality = el.text.trim();
      if (resLabel) {
        quality = `${resLabel}p` + (fansubLabel ? ` - ${fansubLabel}` : "") + (audioLabel ? ` [${audioLabel.toUpperCase()}]` : "");
      }
      if (!quality) quality = `Server ${i + 1}`;

      // Extract direct m3u8 from Kwik embed
      if (href.includes("kwik")) {
        const directM3u8 = await this.extractKwik(href, url);
        if (directM3u8) {
          videos.push({
            url: directM3u8,
            originalUrl: directM3u8,
            quality: `${quality} (HLS)`,
            headers: {
              "User-Agent": this.headers["User-Agent"],
              "Referer": "https://kwik.cx/"
            }
          });
          continue;
        }
      }

      // Fallback - only push if it is a genuine direct stream URL
      if (href.includes(".m3u8") || href.includes(".mp4")) {
        videos.push({
          url: href,
          originalUrl: href,
          quality: quality,
          headers: {
            "User-Agent": this.headers["User-Agent"],
            "Referer": "https://animepahe.pw/"
          }
        });
      }
    }

    return videos;
  }
}
