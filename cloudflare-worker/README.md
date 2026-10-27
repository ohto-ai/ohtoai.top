# 面向 Agent 的边缘增强 — 部署说明

Worker 现在承担三件事：

1. **Markdown for Agents**：请求带 `Accept: text/markdown` 时返回
   `Content-Type: text/markdown` 的正文（附 `x-markdown-tokens`），其余请求维持 HTML 不变。
2. **API 目录（RFC 9727）**：`/.well-known/api-catalog` 的 Content-Type 修正为
   `application/linkset+json` —— GitHub Pages 对无扩展名文件只能返回
   `application/octet-stream`，这个头只能在边缘改。
3. **Link 响应头（RFC 8288 / RFC 9727 §3）**：所有 HTML 响应（含 Markdown
   转换结果）追加 `api-catalog` / `service-desc` / `service-doc` /
   `describedby` / `alternate` 的 Link 头 —— 源站（GitHub Pages）无法
   自定义响应头，同样只能在边缘加。

源站是 GitHub Pages 静态托管，以上都做不了，只能在 Cloudflare 边缘补
（ohtoai.top 已走 Cloudflare 代理）。

## 方案 A（推荐，零代码）：开启 Cloudflare Beta 开关

Cloudflare 官方的 [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
在边缘实时把 HTML 转成 Markdown，行为与本目录 Worker 一致
（自动附 `Vary: accept`，未声明信号时加默认 `Content-Signal`）。

1. 登录 Cloudflare Dashboard → 选择 `ohtoai.top` 域
2. 左侧 **AI Crawl Control**（或 Features/Beta 区）→ **Markdown for Agents** → Enable
3. 验证：
   ```bash
   curl -s -H "Accept: text/markdown" https://ohtoai.top/ -o /dev/null -D -
   # 期望：content-type: text/markdown 且 body 为 Markdown
   ```
   （Beta 功能的可见性与套餐有关；如果面板里没有这个开关，用方案 B。）
   注意：即使开了 Beta 开关，`/.well-known/api-catalog` 的头修正仍需要
   本 Worker 或一条 Transform Rule（响应头改写）。

## 方案 B：部署本目录的 Worker

1. Cloudflare Dashboard → **Workers & Pages** → Create → Worker，命名如 `md-for-agents`
2. 把 [`markdown-negotiation.worker.js`](./markdown-negotiation.worker.js) 全文粘贴进编辑器，Deploy
3. 该 Worker 的 **Settings → Domains & Routes → Add Route**：
   - Zone: `ohtoai.top`，Route: `ohtoai.top/*`
4. 验证同上。

Worker 说明：非 markdown 请求原样透传（对站点零侵入）；回源时显式带
`Accept: text/html` 防止回环；HTML→Markdown 用 HTMLRewriter 流式转换，
覆盖标题/段落/链接/列表/强调/图片/代码/表格单元格。

## 仓库侧已就位的部分（与边缘方案互补）

- `/index.md` —— 首页的静态 Markdown 表示，手工与 index.html 同步维护
- index.html `<head>` 里的 `<link rel="alternate" type="text/markdown" href="/index.md">`
  —— 供不发 Accept 头的 Agent 直接发现

## 验证（部署任一边缘方案后）

```bash
curl -s -m 60 -X POST https://isitagentready.com/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ohtoai.top"}'
# 检查 checks.contentAccessibility.markdownNegotiation.status == "pass"
```
