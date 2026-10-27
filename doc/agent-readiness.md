# Agent Readiness — 网站AI适配实施手册

> 本站（ohtoai.top）2026-10 完整做过一轮 AI 爬虫适配，本文是从中提炼的可复用清单。
> 适用前提：静态站点 + Cloudflare 代理（本仓库架构）。每节标注了哪些部分需要按站点定制。

## 总览

| 检查项 | 落地文件 | 依赖 | 定制度 |
| --- | --- | --- | --- |
| robots.txt（RFC 9309） | `/robots.txt` | 无 | 站点策略 |
| sitemap（Sitemaps 协议） | `/sitemap.xml` | robots.txt 引用 | 页面清单 |
| AI 爬虫规则 | robots.txt 内分组 | 无 | 策略 |
| Content-Signal | robots.txt 内一行 | 无 | 策略 |
| auth.md | `/auth.md` | 无（无 OAuth 时自包含） | 诚实描述 |
| Markdown 表示 | `/index.md` + HTML alternate | 无 | 内容同步 |
| API 目录（RFC 9727） | `/.well-known/api-catalog` + OpenAPI 规范 | 站点得有真 API | 按 API 写 |
| Markdown 协商 + Link 头 + 目录 Content-Type | 边缘 Worker | Cloudflare | LINK_HEADERS / SKIP_SELECTOR |
| `.nojekyll` | `/.nojekyll` | GitHub Pages | 无 |

验证工具（本轮任务来源）：`POST https://isitagentready.com/api/scan`，body
`{"url": "https://你的域名"}`。

---

## 1. robots.txt

三块内容：通用爬虫策略、AI 爬虫显式分组、Content-Signal。完整样例见本仓库
`/robots.txt`，要点：

```
# AI 搜索爬虫（决定是否出现在 AI 回答里）
User-agent: OAI-SearchBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
Allow: /
Disallow: /404.html

# AI 训练爬虫（屏蔽不影响搜索可见性；想退出训练语料就把这组改成 Disallow: /）
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
User-agent: Bytespider
User-agent: Amazonbot
Allow: /
Disallow: /404.html

# 用户触发型抓取（用户主动让 AI 读页面）
User-agent: ChatGPT-User
User-agent: Claude-User
User-agent: Perplexity-User
Allow: /
Disallow: /404.html

User-agent: *
Allow: /
Disallow: /404.html
Content-Signal: search=yes, ai-train=yes, ai-input=yes

Sitemap: https://<域名>/sitemap.xml
```

注意：`Claude-Web` 已被 Anthropic 弃用，现役是 `ClaudeBot` / `Claude-SearchBot`。
Content-Signal 三值必须与上面的 Allow/Disallow 政策一致——声明与规则矛盾比缺声明更糟。

## 2. sitemap.xml

- `<loc>` 全部用 canonical 绝对 URL；`<lastmod>` 用各文件最后一次提交日期
  （`git log -1 --format=%as -- <path>`）
- 只列真正的公开内容页；404 页（robots 已排除）和组件演示不列
- 文件头写维护约定（本站样例：发布/下线页面时同步增删条目），robots.txt 引用它后不要改名

## 3. auth.md

无 OAuth 的站点走「自包含」路线。结构：H1 必须含 `auth.md` → 受众 → 公开内容无需鉴权
→ API 与凭据方法 → **结构化 `agent_auth` YAML 块** → 明确声明无 OAuth。

```yaml
agent_auth:
  skill: auth.md
  audience: <谁会用你的站>
  register_uri: null            # 没有自助注册就写 null，别编 URI
  provisioning_contact: mailto:<邮箱>
  registration_methods:
    - type: manual_request      # 或者你真实的签发方式
      self_service: false
      method: pre_shared_key
      credential_use: HTTP header "x-picbed-key: <key>"
      scope: <哪个 API、哪些端点>
      oauth: false
  public_access:
    requires_auth: false
```

红线：**不要发布指向不存在基础设施的 PRM / OAuth 元数据**。扫描器会因缺
`/.well-known/oauth-protected-resource` 继续报 fail，那是「不适用」而不是
「没做完」——虚假安全元数据会误导 Agent 走不存在的流程。除非真的给 API
实现了 OAuth，否则停在自包含 auth.md。

## 4. Markdown 表示（静态部分）

- 根路径放 `/index.md`（无 front matter，GitHub Pages 会原生以
  `text/markdown` 返回），内容与首页同步维护
- HTML `<head>` 加：`<link rel="alternate" type="text/markdown" href="/index.md" />`
- Agent 即使不发 Accept 头也能经此发现 Markdown 版

## 5. API 目录（仅当站点有真 API）

- `/.well-known/api-catalog`，格式为 RFC 9727 linkset JSON：

```json
{ "linkset": [ {
    "anchor": "https://api.example.com",
    "service-desc": [ { "href": "https://<域名>/doc/api.openapi.json",
                        "type": "application/vnd.oai.openapi+json" } ],
    "service-doc":  [ { "href": "https://github.com/<仓库>", "type": "text/html" } ],
    "status":       [ { "href": "https://api.example.com/health", "type": "application/json" } ]
} ] }
```

- service-desc 的 OpenAPI 规范必须**按真实端点写**（从源码/README 核对鉴权方式、
  错误语义），没有 API 的站点跳过这一节，目录放空壳没有意义
- status 用真实的公开存活端点即可，不必专门做 /health

**GitHub Pages 坑**：Jekyll 会跳过点目录，`/.well-known/` 直接 404——仓库根
必须放 `.nojekyll`（纯静态站禁用 Jekyll 零副作用）。

## 6. 边缘 Worker（协商 + Link 头，GitHub Pages 必需）

源站是静态托管时，三件事只能在 Cloudflare 边缘做：

1. `Accept: text/markdown` → 返回 `text/markdown`（附 `x-markdown-tokens`）
2. `/.well-known/api-catalog` 的 Content-Type 修正为 `application/linkset+json`
   （源站对无扩展名文件只会给 octet-stream）
3. HTML 响应注入 RFC 8288 Link 头（`api-catalog` / `service-desc` / `service-doc`
   / `describedby` / `alternate`）

现成代码：本仓库 `cloudflare-worker/markdown-negotiation.worker.js`，复用时改两处：

- `LINK_HEADERS`：指向你站点的目录/规范/描述文件
- `SKIP_SELECTOR`：补上你站点里 CSS 隐藏的结构件（预加载器、导航、背景层），
  否则它们会漏进 Markdown 正文

设计纪律（都是踩过的坑）：

- `new HTMLRewriter().transform(res)` 返回 **Response**，流要取
  `.body.pipeTo(...)` —— 直接 `.pipeTo()` 是 TypeError，Worker 1101
- 整个转换分支必须 try/catch，失败降级为返回原 HTML。增强型 Worker
  **永远不能把站点打挂**
- 回源时显式带 `Accept: text/html`，防止回环
- 非 markdown 请求一律原样透传

部署（三选一）：

- Dashboard：Workers & Pages → 粘贴代码 → 加路由 `<域名>/*`
- API（有令牌时）：`PUT /accounts/{account_id}/workers/scripts/<名字>`
  multipart 上传，坑见下
- 若开启 Cloudflare「Markdown for Agents」Beta（AI Crawl Control 面板），
  第 1 件自动完成，第 2/3 件仍需本 Worker 或 Transform Rule

API 上传的三个坑：

- `keep_bindings` 是数组不是布尔；无绑定就整个别传
- `compatibility_date` 不能晚于运行时版本（用月初日期最稳）
- multipart 里模块文件的 `filename` 必须与 metadata 的 `main_module` 一致
  （curl 会用真实文件名，要显式 `;filename=worker.js`）

替代：只想要 Link 头的话，Transform Rule（Response Header Modification）
设一个静态 `Link` 头即可，多个值逗号分隔写在一个 value 里。

## 7. 验证

```bash
# Markdown 协商
curl -s -H "Accept: text/markdown" https://<域名>/ -D - -o /tmp/md.txt
# 期望：content-type: text/markdown + x-markdown-tokens + Link 头，正文干净

# Link 头
curl -s -I https://<域名>/ | grep -i "^link"

# API 目录
curl -s -I https://<域名>/.well-known/api-catalog   # application/linkset+json

# 官方扫描
curl -s -m 60 -X POST https://isitagentready.com/api/scan \
  -H "Content-Type: application/json" -d '{"url": "https://<域名>"}'
```

扫描里 `pass` 的合理上限：静态站做到 robotsTxt / sitemap / robotsTxtAiRules /
contentSignals / linkHeaders / markdownNegotiation / apiCatalog 全绿即满分；
authMd/oauth 系列需要真实 OAuth 基础设施，mcpServerCard/agentSkills 等需要
真实的 Agent 协议服务——不要为凑 pass 编造假发现文档。
