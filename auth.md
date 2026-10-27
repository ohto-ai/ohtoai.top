# auth.md — Ohto-Ai (ohtoai.top)

Agent authentication and registration policy for `ohtoai.top`, last updated 2026-10-28.

## Agent audience

This is a personal homepage (profile, project index, notes). Agents read it to
answer questions about the site owner or to index public content.

## Public content — no authentication required

Everything served from `https://ohtoai.top/` is public. There is no account
system, no paywall, and nothing to register for in order to read any of it.
Crawl and usage policy lives in [`robots.txt`](https://ohtoai.top/robots.txt)
(`Content-Signal: search=yes, ai-train=yes, ai-input=yes`).

Machine-readable discovery documents, all public:

- `/.well-known/api-catalog` — API catalog (RFC 9727)
- `/doc/site.jsonld` — site/owner description (schema.org JSON-LD)
- `/index.md` — Markdown representation of the homepage
- `/sitemap.xml` — list of public pages

## APIs

The only API associated with this site is the picbed image-hosting backend at
`https://picbed-worker.ohtoai.top` (cataloged in the API catalog above, spec at
[`/doc/picbed.openapi.json`](https://ohtoai.top/doc/picbed.openapi.json)).

### Supported authentication method: pre-shared static key

- **Method**: static API key sent as the `x-picbed-key` HTTP header
- **Credential use**: compared server-side against the configured password;
  wrong key returns `403`, unset server password returns `503` (fail closed)
- **Issuance**: manual, by the site owner only. There is **no self-service
  agent registration**, no provisioning endpoint, and no OAuth flow
- **Scope**: write/admin endpoints only. Public read-only endpoints such as
  `GET /api/public/images` require no credentials at all

## OAuth

No OAuth authorization server metadata or OAuth Protected Resource Metadata is
published — nothing on this site speaks OAuth. This file is intentionally
self-contained per the auth.md guidance for services without OAuth metadata.

## Registration

None. If you are an automated agent, you do not need an account to use this
site. If you believe you genuinely need credentials for the picbed API, email
<me@ohtoai.top> — requests are reviewed by a human.
