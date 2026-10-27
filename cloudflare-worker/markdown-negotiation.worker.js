/**
 * markdown-negotiation.worker.js — Markdown for Agents 边缘协商
 *
 * ohtoai.top 是 GitHub Pages 静态源站，无法在源站做 Accept 头协商。
 * 本 Worker 部署在 Cloudflare（route: ohtoai.top/*）后补上这一层：
 *
 *   · 请求带 Accept: text/markdown  → 回源取 HTML，边缘转成 Markdown，
 *     以 text/markdown 返回，附 x-markdown-tokens（粗估 token 数）
 *   · 其余请求                      → 原样透传，浏览器行为不变
 *
 * 部署方式见同目录 README.md。
 * 注意：若改用 Cloudflare 仪表盘的「Markdown for Agents」Beta 开关，
 * 本 Worker 即属多余，二选一即可。
 */

const MD_TYPES = /text\/markdown/i;

/** 不采集正文的结构性元素 */
const SKIP_SELECTOR = "head, script, style, svg, noscript, nav, footer, template, form";

export default {
  async fetch(request) {
    const accept = request.headers.get("accept") || "";

    // 普通浏览器/爬虫：原样透传，一行不多管
    if (!MD_TYPES.test(accept)) {
      return fetch(request);
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

    const markdown = await htmlToMarkdown(upstream, url);
    // 粗估：英文语料约 4 字符 ≈ 1 token
    const tokens = Math.ceil(markdown.length / 4);

    return new Response(markdown, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "x-markdown-tokens": String(tokens),
        // 缓存必须区分 HTML / Markdown 两个变体
        vary: "accept",
        "cache-control": "no-store",
      },
    });
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

    rewriter
      .transform(response)
      .pipeTo(
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
