/**
 * AnimeX Extension (animex.one) for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "AnimeX (One)",
    "id": 86910452,
    "baseUrl": "https://animex.one",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animex.one",
    "dateFormat": "yyyy-MM-dd",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.2",
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
      "Referer": "https://animex.one/"
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

  async resolveEmbed(embedUrl, label) {
    const results = [];
    if (!embedUrl) return results;

    try {
      // 1. Dailymotion
      if (embedUrl.includes("dailymotion") || embedUrl.includes("dai.ly")) {
        const dmMatch = embedUrl.match(/video=([a-zA-Z0-9]+)/) ||
                        embedUrl.match(/dailymotion\.com\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/) ||
                        embedUrl.match(/dai\.ly\/([a-zA-Z0-9]+)/);
        if (dmMatch && dmMatch[1]) {
          const dmRes = await this.client.get(`https://www.dailymotion.com/player/metadata/video/${dmMatch[1]}`, {
            "User-Agent": this.headers["User-Agent"]
          });
          const meta = JSON.parse(dmRes.body);
          if (meta && meta.qualities && meta.qualities.auto && meta.qualities.auto.length > 0) {
            results.push({
              url: meta.qualities.auto[0].url,
              originalUrl: meta.qualities.auto[0].url,
              quality: `${label} - Auto (HLS)`,
              headers: {
                "User-Agent": this.headers["User-Agent"],
                "Referer": "https://www.dailymotion.com/"
              }
            });
            return results;
          }
        }
      }

      // 2. Direct playable m3u8 or mp4
      if (embedUrl.includes(".m3u8") || embedUrl.includes(".mp4")) {
        results.push({
          url: embedUrl,
          originalUrl: embedUrl,
          quality: label,
          headers: this.headers
        });
        return results;
      }

      // 3. Generic embed pages: fetch and inspect
      const pageRes = await this.client.get(embedUrl, {
        "User-Agent": this.headers["User-Agent"],
        "Referer": this.headers["Referer"]
      });
      const html = pageRes.body || "";
      const packed = html.match(/eval\(function\(p,a,c,k,e,[\s\S]*?\.split\('\|'\)\)\)/);
      let target = html;
      if (packed) {
        target = this.unpackJs(packed[0]);
      }
      const m3u8Match = target.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
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
    } catch (_) {}

    if (embedUrl.includes(".m3u8") || embedUrl.includes(".mp4")) {
      results.push({
        url: embedUrl,
        originalUrl: embedUrl,
        quality: label,
        headers: this.headers
      });
    }
    return results;
  }

  parseCards(html) {
    const doc = new Document(html);
    const anchors = doc.select('a[href^="/anime/"], a[href*="animex.one/anime/"]');
    const list = [];
    const seen = {};

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      let link = a.attr("href") || "";
      if (!link || link === "/anime" || link === "/anime/" || link.includes("?")) continue;
      if (!link.startsWith("http")) {
        link = `https://animex.one${link.startsWith("/") ? "" : "/"}${link}`;
      }

      if (seen[link]) continue;
      seen[link] = true;

      const imgEl = a.selectFirst("img");
      const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

      const titleEl = a.selectFirst("h3, h4, span.font-semibold, .title") || a;
      let name = (a.attr("title") || (titleEl ? titleEl.text : "")).trim();
      if (!name || name.length > 80 || name === "TV" || name === "MOVIE") continue;

      list.push({ name, link, imageUrl });
    }

    return { list, hasNextPage: false };
  }

  async getPopular(page) {
    const url = "https://animex.one/trending";
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = "https://animex.one/recent";
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://animex.one/search?q=${q}`;
    const res = await this.client.get(url, this.headers);
    return this.parseCards(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h1, .anime-title, .title");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".poster img, .cover img, img");
    const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

    const descEl = doc.selectFirst("p.leading-relaxed, .description, .synopsis, p");
    const description = descEl ? descEl.text.trim() : "";

    const genreEls = doc.select('a[href*="/genre/"], a[href*="/tag/"]');
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    const episodes = [];
    const epEls = doc.select('a[href^="/watch/"], a[href*="animex.one/watch/"]');
    const seen = {};

    for (let i = 0; i < epEls.length; i++) {
      const a = epEls[i];
      let epUrl = a.attr("href") || "";
      if (!epUrl.startsWith("http")) {
        epUrl = `https://animex.one${epUrl.startsWith("/") ? "" : "/"}${epUrl}`;
      }

      if (seen[epUrl]) continue;
      seen[epUrl] = true;

      episodes.push({
        name: a.text.trim() || `Episode ${i + 1}`,
        url: epUrl
      });
    }

    return {
      name,
      imageUrl,
      description,
      author: "AnimeX",
      genre,
      status: 0,
      episodes: episodes.reverse()
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");
    const videos = [];
    const seenUrls = {};

    // 1. Direct iframes in page
    const iframes = doc.select("iframe");
    for (let i = 0; i < iframes.length; i++) {
      let src = iframes[i].attr("src") || "";
      if (src && !src.includes("about:blank") && !src.includes("challenges.cloudflare")) {
        if (src.startsWith("//")) src = `https:${src}`;
        const resolved = await this.resolveEmbed(src, `Server ${i + 1}`);
        for (let j = 0; j < resolved.length; j++) {
          if (!seenUrls[resolved[j].url]) {
            seenUrls[resolved[j].url] = true;
            videos.push(resolved[j]);
          }
        }
      }
    }

    // 2. Direct video sources in scripts
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
