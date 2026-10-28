const mangayomiSources = [{
    "name": "kagane",
    "lang": "en",
    "baseUrl": "https://kagane.net",
    "apiUrl": "https://kagane.net/api",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://kagane.net",
    "typeSource": "single",
    "itemType": 0,
    "isManga": true,
    "isNsfw": true,
    "hasCloudflare": true,
    "version": "0.0.4",
    "pkgPath": "manga/src/en/kagane.js",
    "notes": "Uses kagane.net API with integrity token"
}];

class ProxyClient {
    constructor(prefs) {
        this.prefs = prefs;
        this.client = new Client({
            useDartHttpClient: false,
            verifyCertificates: false
        });
    }

    req(method, url, headers, body) {
        const useProxy = this.prefs.get("proxy-use");
        if (useProxy === true || useProxy === "true") {
            const proxyUrl = this.prefs.get("proxy-url") || "http://localhost:8080";
            return this.client.post(
                proxyUrl,
                {
                    "x-api-key": this.prefs.get("proxy-key") || "",
                    "x-impersonate": this.prefs.get("proxy-impersonate") || "chrome120"
                },
                JSON.stringify({
                    url,
                    method,
                    headers,
                    body: typeof body === "object" ? JSON.stringify(body) : body
                })
            );
        }

        return this.client[method.toLowerCase()](
            url,
            headers,
            body
        );
    }

    head(u,h){return this.req("HEAD",u,h)}
    get(u,h){return this.req("GET",u,h)}
    post(u,h,b){return this.req("POST",u,h,b)}
    put(u,h,b){return this.req("PUT",u,h,b)}
    delete(u,h,b){return this.req("DELETE",u,h,b)}
    patch(u,h,b){return this.req("PATCH",u,h,b)}
}

function buildParams(params) {
    let out = "";

    for (const [key, value] of Object.entries(params)) {
        const k = encodeURIComponent(key);

        if (Array.isArray(value)) {
            for (const v of value) {
                out += (out ? "&" : "") + k + "=" + encodeURIComponent(v);
            }
        } else if (value != null) {
            out += (out ? "&" : "") + k + "=" + encodeURIComponent(value);
        }
    }

    return out;
}

const StatusMap = {
    "Ongoing": 0,
    "Completed": 1,
    "Hiatus": 2,
    "unknown": 5
}

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.prefs = new SharedPreferences();
        this.client = new ProxyClient(this.prefs);
        this.total = 50;
    }

    get baseUrl() {
        return (this.source && this.source.baseUrl) ? this.source.baseUrl : "https://kagane.net";
    }

    get apiUrl() {
        return (this.source && this.source.apiUrl) ? this.source.apiUrl : "https://kagane.net/api";
    }

    async getIntegrityToken() {
        try {
            const res = await this.client.post(
                `${this.apiUrl}/integrity`, 
                { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                {}
            );
            const data = JSON.parse(res.body);
            return data.token || "";
        } catch (_) {
            return "";
        }
    }

    getMangaData(manga, chapters = null) {
        let imageUrl = null;
        if (manga?.cover_image_id) {
            imageUrl = `${this.apiUrl}/v2/image/${manga.cover_image_id}`;
        } else if (manga?.series_covers != null && manga?.series_covers[0]?.image_id) {
            imageUrl = `${this.apiUrl}/v2/image/${manga.series_covers[0].image_id}`;
        }
      
        return {
            name: manga.title || "Unknown",
            imageUrl,
            link: `${this.baseUrl}/series/${manga.series_id}`,
            description: manga?.description ?? "",
            status: StatusMap[manga.upload_status] ?? 0,
            genre: Array.isArray(manga?.genres) ? manga.genres.map(g => g.genre_name || g).filter(Boolean) : [],
            author: manga?.author?.name || "Unknown",
            artist: manga?.artist?.name || "Unknown",
            ...(chapters != null ? { chapters } : {})
        };
    }
    
    async getPopular(page) {
        return await this.searchApi(null, "avg_views_today,desc", page);
    }

    get supportsLatest() {
        return true;
    }

    async getLatestUpdates(page) {
        return await this.searchApi(null, "updated_at,desc", page);
    }

    async searchApi(query=null, sort=null, page=1) {
        let params = {};
        if (sort != null) params["sort"] = sort;
        params["size"] = this.total;
        params["page"] = page - 1;

        let res = await this.client.post(
            `${this.apiUrl}/v2/search/series?${buildParams(params)}`, 
            { 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }, 
            { 
                "content_lang": [],
                "content_rating": [
                    "Safe",
                    "Suggestive",
                    "Erotica",
                    "Pornographic"
                ],
                ...(query != null ? { title: query } : {})
            }
        );
        
        let data = JSON.parse(res.body);
        return {
            list: data?.content?.map((c) => this.getMangaData(c)) ?? [],
            hasNextPage: page < (data?.total_pages ?? page)
        };
    }

    async search(query, page, filters) {
        return await this.searchApi(query, null, page);
    }

    async getDetail(url) {
        const id = url.replace(/\/+$/, "").split("/").pop();
        const infoRes = await this.client.get(
            `${this.apiUrl}/v2/series/${id}`,
            { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        );
        const seriesData = JSON.parse(infoRes.body);

        // Fetch books / chapters
        const chapters = [];
        try {
            const booksRes = await this.client.get(
                `${this.apiUrl}/v2/series/${id}/books?limit=100`,
                { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
            );
            const booksData = JSON.parse(booksRes.body);
            const items = booksData.items || [];
            for (const b of items) {
                const volStr = b.volume_no != null ? `Vol. ${b.volume_no} ` : "";
                const chStr = b.chapter_no != null ? `Ch. ${b.chapter_no}` : "";
                const titleStr = b.title ? ` - ${b.title}` : "";
                const name = (volStr + chStr + titleStr).trim() || b.title || `Chapter ${b.sort_no || ""}`;
                const chUrl = `${this.baseUrl}/series/${id}/reader/${b.book_id}`;

                let scan = "Kagane";
                if (b.groups && b.groups[0] && b.groups[0].title) {
                    scan = b.groups[0].title;
                } else if (b.uploader && b.uploader.username) {
                    scan = b.uploader.username;
                }

                chapters.push({
                    name,
                    url: chUrl,
                    dateUpload: b.created_at ? String(new Date(b.created_at).getTime()) : null,
                    scanlator: scan
                });
            }
        } catch (_) {}

        return this.getMangaData(seriesData, chapters);
    }

    async getPageList(url) {
        const bookid = url.replace(/\/+$/, "").split("/").pop();
        const integrityToken = await this.getIntegrityToken();

        const res = await this.client.post(
            `${this.apiUrl}/v2/books/${bookid}?is_datasaver=false`,
            {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "x-integrity-token": `${integrityToken}`
            },
            {}
        );

        const data = JSON.parse(res.body);
        const cacheUrl = (data.cache_url || "https://kstatic.to").replace(/\/+$/, "");
        const accessToken = encodeURIComponent(data.access_token || "");
        const pages = [];

        if (data.manifest && Array.isArray(data.manifest.pages)) {
            for (const p of data.manifest.pages) {
                const ext = p.ext || "jpeg";
                // 'page' route serves standard jpeg; 'page/datasaver' serves webp
                const imgUrl = `${cacheUrl}/api/v2/books/page/${bookid}/${p.page_id}.${ext}?token=${accessToken}`;
                pages.push({
                    url: imgUrl,
                    headers: {
                        "Referer": "https://kagane.net/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    }
                });
            }
        }

        return pages;
    }
    getFilterList() {
        throw new Error("getFilterList not implemented");
    }
    getSourcePreferences() {
        return [
            {
                "key": "proxy-use",
                "checkBoxPreference": {
                    "title": "cloudflare proxy",
                    "summary": "Use a custom cloudflare proxy",
                    "value": false
                }
            },{
                "key": "proxy-url",
                "editTextPreference": {
                    "title": "Set Cloudflare proxy url",
                    "summary": "Cloudflare proxy url",
                    "value": "http://localhost:8080",
                    "dialogTitle": "Custom Proxy URL",
                    "dialogMessage": "set the proxy url to use",
                }
            },{
                "key": "proxy-key",
                "editTextPreference": {
                    "title": "Set Cloudflare proxy API key",
                    "summary": "Cloudflare proxy API Key",
                    "value": "secret123",
                    "dialogTitle": "Proxy URL API Key",
                    "dialogMessage": "set the proxy API Key",
                }
            },{
                "key": "proxy-impersonate",
                "editTextPreference": {
                    "title": "Set Cloudflare browser impersonation",
                    "summary": "Cloudflare browser impersonation",
                    "value": "chrome120",
                    "dialogTitle": "Proxy Impersonation",
                    "dialogMessage": "set the browser impersonation to use",
                }
            }
        ]
    }
}

