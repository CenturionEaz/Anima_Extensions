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
    "version": "0.1.1",
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

  async resolveWcoEmbed(embedUrl, label) {
    const results = [];
    if (!embedUrl) return results;

    try {
      if (embedUrl.includes(".m3u8") || embedUrl.includes(".mp4")) {
        results.push({
          url: embedUrl,
          originalUrl: embedUrl,
          quality: label,
          headers: this.headers
        });
        return results;
      }

      const res = await this.client.get(embedUrl, {
        "User-Agent": this.headers["User-Agent"],
        "Referer": "https://www.wcostream.tv/"
      });
      const html = res.body || "";

      // 1. Direct mp4/m3u8 in embed script or json
      const m3u8Match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
      if (m3u8Match && m3u8Match[1]) {
        results.push({
          url: m3u8Match[1],
          originalUrl: m3u8Match[1],
          quality: `${label} - Stream (HLS)`,
          headers: {
            "User-Agent": this.headers["User-Agent"],
            "Referer": embedUrl
          }
        });
        return results;
      }

      const mp4Match = html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
      if (mp4Match && mp4Match[1]) {
        results.push({
          url: mp4Match[1],
          originalUrl: mp4Match[1],
          quality: `${label} - MP4`,
          headers: {
            "User-Agent": this.headers["User-Agent"],
            "Referer": embedUrl
          }
        });
        return results;
      }

      // 2. Packed script
      const packed = html.match(/eval\(function\(p,a,c,k,e,[\s\S]*?\.split\('\|'\)\)\)/);
      if (packed) {
        const unpacked = this.unpackJs(packed[0]);
        const subM3u8 = unpacked.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (subM3u8 && subM3u8[1]) {
          results.push({
            url: subM3u8[1],
            originalUrl: subM3u8[1],
            quality: `${label} - Stream (HLS)`,
            headers: {
              "User-Agent": this.headers["User-Agent"],
              "Referer": embedUrl
            }
          });
          return results;
        }
        const subMp4 = unpacked.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
        if (subMp4 && subMp4[1]) {
          results.push({
            url: subMp4[1],
            originalUrl: subMp4[1],
            quality: `${label} - MP4`,
            headers: {
              "User-Agent": this.headers["User-Agent"],
              "Referer": embedUrl
            }
          });
          return results;
        }
      }
    } catch (_) {}

    results.push({
      url: embedUrl,
      originalUrl: embedUrl,
      quality: label,
      headers: this.headers
    });
    return results;
  }

  parseAnimeList(html) {
    const doc = new Document(html);
    const items = doc.select(".sidebar_right .items li, .content_block .items li, ul.items li");
    const list = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const a = item.selectFirst("a");
      if (!a) continue;

      let link = a.attr("href") || "";
      if (!link.startsWith("http")) {
        link = `https://www.wcostream.tv${link.startsWith("/") ? "" : "/"}${link}`;
      }

      const img = item.selectFirst("img");
      const imageUrl = img ? (img.attr("src") || img.attr("data-src") || "") : "";
      const name = (a.attr("title") || a.text || "").trim();

      if (name && link) {
        list.push({ name, link, imageUrl });
      }
    }

    const nextEl = doc.selectFirst(".pagination .next, a:contains('Next')");
    const hasNextPage = !!(nextEl && nextEl.attr("href"));

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = "https://www.wcostream.tv/subbed-anime-list";
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = "https://www.wcostream.tv/last-50-recent-release";
    const res = await this.client.get(url, this.headers);
    return this.parseAnimeList(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://www.wcostream.tv/search`;
    const res = await this.client.post(url, {
      ...this.headers,
      "Content-Type": "application/x-www-form-urlencoded"
    }, `catara=${q}&konujson=1`);
    return this.parseAnimeList(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("#recent-content h1, h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".featured-thumbnail img, img");
    const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

    const descEl = doc.selectFirst("#recent-content p, .content p, p");
    const description = descEl ? descEl.text.trim() : "";

    const episodes = [];
    const epEls = doc.select("#catlist-listview a, #sidebar_right a, .catlist a");
    for (let i = 0; i < epEls.length; i++) {
      const a = epEls[i];
      let epUrl = a.attr("href") || "";
      if (!epUrl || epUrl.includes("/subbed-anime-list") || epUrl.includes("/dubbed-anime-list")) continue;
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
    const seenUrls = {};

    const iframes = doc.select("iframe");
    for (let i = 0; i < iframes.length; i++) {
      let src = iframes[i].attr("src") || "";
      if (src && !src.includes("about:blank") && !src.includes("ads") && !src.includes("challenges.cloudflare")) {
        if (src.startsWith("//")) src = `https:${src}`;
        const resolved = await this.resolveWcoEmbed(src, `Server ${i + 1}`);
        for (let j = 0; j < resolved.length; j++) {
          if (!seenUrls[resolved[j].url]) {
            seenUrls[resolved[j].url] = true;
            videos.push(resolved[j]);
          }
        }
      }
    }

    const html = res.body || "";
    const m3u8Match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
    if (m3u8Match && m3u8Match[1] && !seenUrls[m3u8Match[1]]) {
      seenUrls[m3u8Match[1]] = true;
      videos.push({
        url: m3u8Match[1],
        originalUrl: m3u8Match[1],
        quality: "Direct Stream (HLS)",
        headers: this.headers
      });
    }

    return videos;
  }
}
