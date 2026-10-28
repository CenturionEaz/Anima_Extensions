/**
 * DonghuaStream Extension for AnymeX & Mangayomi
 * itemType: 1 (Anime)
 */

const mangayomiSources = [
  {
    "name": "DonghuaStream",
    "id": 84192038,
    "baseUrl": "https://donghuastream.org",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://donghuastream.org",
    "dateFormat": "MMMM dd, yyyy",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.1",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.1.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "Direct HLS Stream Extractor for Dailymotion, Ok.ru, and StreamWish"
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
      "Referer": "https://donghuastream.org/"
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

  decodeBase64(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    str = String(str).replace(/=+$/, "");
    for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
      const charIndex = chars.indexOf(buffer);
      if (~charIndex) {
        bs = bc % 4 ? bs * 64 + charIndex : charIndex;
        if (bc++ % 4) {
          output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
      }
    }
    return output;
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

      // 2. Ok.ru
      if (embedUrl.includes("ok.ru")) {
        const okMatch = embedUrl.match(/ok\.ru\/(?:videoembed|video)\/(\d+)/);
        if (okMatch && okMatch[1]) {
          const okRes = await this.client.get(`https://ok.ru/videoembed/${okMatch[1]}`, {
            "User-Agent": this.headers["User-Agent"]
          });
          const optMatch = (okRes.body || "").match(/data-module="OKVideo"[^>]*data-options="([^"]+)"/);
          if (optMatch) {
            const decoded = optMatch[1].replace(/&quot;/g, '"');
            const data = JSON.parse(decoded);
            if (data && data.flashvars && data.flashvars.metadata) {
              let meta = data.flashvars.metadata;
              if (typeof meta === "string") {
                try { meta = JSON.parse(meta); } catch (_) { meta = null; }
              }
              if (meta) {
                if (meta.hlsManifestUrl) {
                  results.push({
                    url: meta.hlsManifestUrl,
                    originalUrl: meta.hlsManifestUrl,
                    quality: `${label} - HLS Master`,
                    headers: { "User-Agent": this.headers["User-Agent"] }
                  });
                }
                if (Array.isArray(meta.videos)) {
                  for (let i = 0; i < meta.videos.length; i++) {
                    const v = meta.videos[i];
                    results.push({
                      url: v.url,
                      originalUrl: v.url,
                      quality: `${label} - ${v.name || "MP4"}`,
                      headers: { "User-Agent": this.headers["User-Agent"] }
                    });
                  }
                }
                if (results.length > 0) return results;
              }
            }
          }
        }
      }

      // 3. Direct playable m3u8 or mp4
      if (embedUrl.includes(".m3u8") || embedUrl.includes(".mp4")) {
        results.push({
          url: embedUrl,
          originalUrl: embedUrl,
          quality: label,
          headers: this.headers
        });
        return results;
      }

      // 4. StreamWish / Generic embed pages: fetch and inspect
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

    // Fallback if no direct stream could be parsed
    results.push({
      url: embedUrl,
      originalUrl: embedUrl,
      quality: label,
      headers: this.headers
    });
    return results;
  }

  parseAnime(html) {
    const doc = new Document(html);
    const items = doc.select("article.bs, .listupd article, .animepost");
    const list = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const linkEl = item.selectFirst("a");
      if (!linkEl) continue;
      const link = linkEl.attr("href") || "";
      const titleEl = item.selectFirst(".tt, h2, .title");
      const name = titleEl ? titleEl.text.trim() : (linkEl.attr("title") || "").trim();
      const imgEl = item.selectFirst("img");
      const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

      if (name && link) {
        list.push({ name, link, imageUrl });
      }
    }

    const nextEl = doc.selectFirst(".pagination .next, a.next");
    const hasNextPage = !!(nextEl && nextEl.attr("href"));

    return { list, hasNextPage };
  }

  async getPopular(page) {
    const url = `https://donghuastream.org/anime/?page=${page}&status=&type=&order=popular`;
    const res = await this.client.get(url, this.headers);
    return this.parseAnime(res.body || "");
  }

  async getLatestUpdates(page) {
    const url = `https://donghuastream.org/anime/?page=${page}&status=&type=&order=update`;
    const res = await this.client.get(url, this.headers);
    return this.parseAnime(res.body || "");
  }

  async search(query, page, filters) {
    const q = encodeURIComponent((query || "").trim());
    const url = `https://donghuastream.org/?s=${q}`;
    const res = await this.client.get(url, this.headers);
    return this.parseAnime(res.body || "");
  }

  async getDetail(url) {
    const res = await this.client.get(url, this.headers);
    const doc = new Document(res.body || "");

    const titleEl = doc.selectFirst("h1.entry-title, .entry-title, h1");
    const name = titleEl ? titleEl.text.trim() : "";

    const imgEl = doc.selectFirst(".thumb img, .thumbx img, .animeposter img");
    const imageUrl = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";

    const descEl = doc.selectFirst(".entry-content, .desc, .synopsis, .shortdesc");
    const description = descEl ? descEl.text.trim() : "";

    const authorEl = doc.selectFirst(".spe span:contains('Studio'), .spe span:contains('Author')");
    const author = authorEl ? authorEl.text.replace(/Studio|Author|:/gi, "").trim() : "";

    const genreEls = doc.select(".genxed a, .genre-info a");
    const genre = [];
    for (let i = 0; i < genreEls.length; i++) {
      genre.push(genreEls[i].text.trim());
    }

    const episodes = [];
    const epEls = doc.select(".eplister ul li a, .eplister a");
    for (let i = 0; i < epEls.length; i++) {
      const a = epEls[i];
      const epNumEl = a.selectFirst(".epl-num");
      const epTitleEl = a.selectFirst(".epl-title");
      const epDateEl = a.selectFirst(".epl-date");

      const epNum = epNumEl ? epNumEl.text.trim() : "";
      const epTitle = epTitleEl ? epTitleEl.text.trim() : "";
      const epName = epNum ? (epTitle ? `Episode ${epNum} - ${epTitle}` : `Episode ${epNum}`) : (a.text.trim() || `Episode ${i + 1}`);

      episodes.push({
        name: epName,
        url: a.attr("href") || "",
        dateUpload: epDateEl ? epDateEl.text.trim() : null
      });
    }

    return {
      name,
      imageUrl,
      description,
      author,
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

    // 1. Direct iframe player in page
    const iframeEl = doc.selectFirst(".player-embed iframe, iframe");
    if (iframeEl) {
      const src = iframeEl.attr("src") || "";
      if (src && !src.includes("about:blank")) {
        const fullSrc = src.startsWith("//") ? `https:${src}` : src;
        const resolved = await this.resolveEmbed(fullSrc, "Default Player");
        for (let j = 0; j < resolved.length; j++) {
          if (!seenUrls[resolved[j].url]) {
            seenUrls[resolved[j].url] = true;
            videos.push(resolved[j]);
          }
        }
      }
    }

    // 2. Mirrors in select dropdown with base64 encoded iframes
    const options = doc.select("select.mirror option");
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const val = opt.attr("value") || "";
      const label = opt.text.trim();
      if (!val || val === "") continue;

      try {
        const decoded = this.decodeBase64(val);
        const match = decoded.match(/src=["']([^"']+)["']/);
        if (match && match[1]) {
          let embedUrl = match[1];
          if (embedUrl.startsWith("//")) embedUrl = `https:${embedUrl}`;
          const resolved = await this.resolveEmbed(embedUrl, label || `Server ${i}`);
          for (let j = 0; j < resolved.length; j++) {
            if (!seenUrls[resolved[j].url]) {
              seenUrls[resolved[j].url] = true;
              videos.push(resolved[j]);
            }
          }
        }
      } catch (_) {}
    }

    return videos;
  }
}
