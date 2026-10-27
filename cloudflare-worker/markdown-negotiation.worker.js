/**
 * markdown-negotiation.worker.js — 面向 Agent 的边缘增强
 *
 * ohtoai.top 是 GitHub Pages 静态源站，无法在源站做 Accept 头协商、
 * 为无扩展名文件指定 Content-Type，或添加自定义响应头。
 * 本 Worker 部署在 Cloudflare（route: ohtoai.top/*）后补上这三层：
 *
 *   · 请求带 Accept: text/markdown  → 回源取 HTML，边缘转成 Markdown，
 *     以 text/markdown 返回，附 x-markdown-tokens（粗估 token 数）
 *   · 请求 /.well-known/api-catalog → 透传响应但把 Content-Type 修正为
 *     application/linkset+json（RFC 9727 要求；源站对无扩展名文件只能
 *     给 application/octet-stream）
 *   · HTML 响应（含 Markdown 转换结果）统一追加 RFC 8288 / RFC 9727 §3
 *     的 Link 响应头（api-catalog / service-desc / service-doc /
 *     describedby / alternate）
 *   · 其余请求                      → 原样透传，浏览器行为不变
 *
 * 部署方式见同目录 README.md。
 * 注意：若改用 Cloudflare 仪表盘的「Markdown for Agents」Beta 开关，
 * Markdown 部分即属多余；api-catalog 的头修正与 Link 头仍需要本
 * Worker（或等价的 Transform Rule）。
 */

const MD_TYPES = /text\/markdown/i;
const API_CATALOG_PATH = "/.well-known/api-catalog";

/** RFC 8288 / RFC 9727 §3 —— HTML 与 Markdown 响应统一携带的 Link 头 */
const LINK_HEADERS = [
    '</.well-known/api-catalog>; rel="api-catalog"',
    '</doc/picbed.openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
    '<https://github.com/ohto-ai/picbed>; rel="service-doc"; type="text/html"',
    '</doc/site.jsonld>; rel="describedby"; type="application/ld+json"',
    '</index.md>; rel="alternate"; type="text/markdown"',
];

/** 给响应追加 Link 头（保留已有的）；非 HTML/Markdown 响应原样返回 */
function withLinkHeaders(response) {
    const ctype = (response.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("text/html") && !ctype.includes("text/markdown")) {
        return response;
    }
    const headers = new Headers(response.headers);
    for (const link of LINK_HEADERS) {
        headers.append("link", link);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

/** 不采集正文的结构性元素 */
const SKIP_SELECTOR = "head, script, style, svg, noscript, nav, footer, template, form";

export default {
  async fetch(request) {
    const accept = request.headers.get("accept") || "";
    const { pathname } = new URL(request.url);

    // RFC 9727 API 目录：修正 Content-Type 后透传
    if (pathname === API_CATALOG_PATH) {
      const upstream = await fetch(request);
      const headers = new Headers(upstream.headers);
      headers.set("content-type", "application/linkset+json");
      headers.set("vary", "accept");
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    // 普通浏览器/爬虫：透传并补上 Link 头
    if (!MD_TYPES.test(accept)) {
      return withLinkHeaders(await fetch(request));
    }

    const url = new URL(request.url);
    // 回源时显式要 HTML —— 防止回源请求再被本 Worker 或边缘特性截获成环
    const upstream = await fetch(url.toString(), {
      headers: { accept: "text/html" },
      redirect: "follow",
    });

    const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("text/html")) {
      // 非 HTML（图片/字体等）没有 Markdown 语义，原样回
      return new Response(upstream.body, upstream);
    }

    // 转换失败绝不能把站点打挂 —— 降级为返回原 HTML（带 Link 头）
    try {
      const markdown = await htmlToMarkdown(upstream, url);
      // 粗估：英文语料约 4 字符 ≈ 1 token
      const tokens = Math.ceil(markdown.length / 4);

      const headers = new Headers({
        "content-type": "text/markdown; charset=utf-8",
        "x-markdown-tokens": String(tokens),
        // 缓存必须区分 HTML / Markdown 两个变体
        vary: "accept",
        "cache-control": "no-store",
      });
      for (const link of LINK_HEADERS) {
        headers.append("link", link);
      }
      return new Response(markdown, { status: 200, headers });
    } catch (e) {
      console.error("markdown conversion failed:", e);
      return withLinkHeaders(upstream);
    }
  },
};

/**
 * HTMLRewriter 流式转换。
 * 只保留正文语义：标题、段落、链接、列表、强调、图片、代码。
 * 转换器是简化实现，面向本站这种简单页面；复杂富文本站点
 * 建议直接用 Cloudflare 的「Markdown for Agents」Beta（Workers AI 转换）。
 */
function htmlToMarkdown(response, baseUrl) {
  return new Promise((resolve) => {
    let out = "";
    let skipDepth = 0;
    const abs = (href) => {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return href;
      }
    };

    const rewriter = new HTMLRewriter()
      .on(SKIP_SELECTOR, {
        element(el) {
          skipDepth++;
          el.onEndTag(() => {
            skipDepth--;
          });
        },
      })
      .onDocument({
        text(t) {
          if (skipDepth === 0) out += t.text;
        },
      })
      .on("h1, h2, h3, h4, h5, h6", {
        element(el) {
          if (skipDepth) return;
          const level = Number(el.tagName.slice(1)) || 1;
          out += "\n\n" + "#".repeat(level) + " ";
          el.onEndTag(() => {
            out += "\n";
          });
        },
      })
      .on("p", {
        element(el) {
          if (skipDepth) return;
          out += "\n\n";
          el.onEndTag(() => {
            out += "\n";
          });
        },
      })
      .on("li", {
        element(el) {
          if (skipDepth) return;
          out += "\n- ";
          el.onEndTag(() => {
            out += "";
          });
        },
      })
      .on("ul, ol, table, blockquote", {
        element(el) {
          if (skipDepth) return;
          out += "\n\n";
          el.onEndTag(() => {
            out += "\n";
          });
        },
      })
      .on("br", {
        element() {
          if (skipDepth) return;
          out += "\n";
        },
      })
      .on("a", {
        element(el) {
          if (skipDepth) return;
          const href = el.getAttribute("href");
          out += "[";
          el.onEndTag(() => {
            out += href ? "](" + abs(href) + ")" : "]";
          });
        },
      })
      .on("img", {
        element(el) {
          if (skipDepth) return;
          const src = el.getAttribute("src");
          const alt = el.getAttribute("alt") || "";
          out += "![" + alt + "](" + (src ? abs(src) : "") + ")";
        },
      })
      .on("strong, b", {
        element(el) {
          if (skipDepth) return;
          out += "**";
          el.onEndTag(() => {
            out += "**";
          });
        },
      })
      .on("em, i", {
        element(el) {
          if (skipDepth) return;
          out += "*";
          el.onEndTag(() => {
            out += "*";
          });
        },
      })
      .on("code", {
        element(el) {
          if (skipDepth) return;
          out += "`";
          el.onEndTag(() => {
            out += "`";
          });
        },
      })
      .on("pre", {
        element(el) {
          if (skipDepth) return;
          out += "\n\n```\n";
          el.onEndTag(() => {
            out += "\n```\n";
          });
        },
      })
      .on("th, td", {
        element(el) {
          if (skipDepth) return;
          out += " | ";
        },
      })
      .on("tr", {
        element(el) {
          if (skipDepth) return;
          out += "\n";
        },
      });

    // transform() 返回 Response，流在 .body 上
    rewriter
      .transform(response)
      .body.pipeTo(
        new WritableStream({
          write() {},
          close() {
            resolve(tidy(out));
          },
          abort() {
            resolve(tidy(out));
          },
        })
      )
      .catch(() => resolve(tidy(out)));
  });
}

/** 收尾：压平空行、去首尾空白、把 HTML 实体交给 Agent 端处理（不在此解码） */
function tidy(s) {
  return s.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
