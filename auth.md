# auth.md — Ohto-Ai (ohtoai.top)

Agent authentication and registration policy for `ohtoai.top`, last updated 2026-10-28.

## Agent audience

This is a personal homepage (profile, project index, notes). Agents read it to
answer questions about the site owner or to index public content. There is no
agent account system on this site.

## Public content — no authentication required

Everything served from `https://ohtoai.top/` is public. Agents do not need to
register or authenticate to read any of it. Crawl and usage policy lives in
[`robots.txt`](https://ohtoai.top/robots.txt)
(`Content-Signal: search=yes, ai-train=yes, ai-input=yes`).

Machine-readable discovery documents, all public:

- `/.well-known/api-catalog` — API catalog (RFC 9727)
- `/doc/site.jsonld` — site/owner description (schema.org JSON-LD)
- `/index.md` — Markdown representation of the homepage
- `/sitemap.xml` — list of public pages

## APIs and credentials

The only API associated with this site is the picbed image-hosting backend at
`https://picbed-worker.ohtoai.top` (cataloged in the API catalog above, spec at
[`/doc/picbed.openapi.json`](https://ohtoai.top/doc/picbed.openapi.json)).

- Public read-only endpoints (e.g. `GET /api/public/images`) require **no
  credentials**.
- Write/admin endpoints require the single authentication method described
  below. Wrong key returns `403`; unset server password returns `503`
  (fail closed).

## Agent registration

Registration method: **none (manual provisioning only)**. There is no
self-service registration or provisioning endpoint that agents can call.
Credentials are issued manually by the site owner on request.

```yaml
agent_auth:
  skill: auth.md
  audience: automated agents interacting with ohtoai.top and its picbed API
  register_uri: null            # no self-service registration endpoint exists
  provisioning_contact: mailto:me@ohtoai.top
  registration_methods:
    - type: manual_request
      self_service: false
      description: >
        Credentials are issued manually by the site owner. Send an email
        describing who you are and why you need write access to the picbed
        API; requests are reviewed by a human.
      method: pre_shared_key
      credential_use: HTTP header "x-picbed-key: <key>" on admin endpoints
      scope: write/admin endpoints of https://picbed-worker.ohtoai.top only
      oauth: false
  public_access:
    requires_auth: false
    note: All public content and GET /api/public/images need no credentials.
```

## OAuth

No OAuth authorization server metadata or OAuth Protected Resource Metadata is
published — nothing on this site speaks OAuth, so there is no
`/.well-known/oauth-protected-resource` or
`/.well-known/oauth-authorization-server` to advertise. This file is
intentionally self-contained per the auth.md guidance for services without
OAuth metadata.
