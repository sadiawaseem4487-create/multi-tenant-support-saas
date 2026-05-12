# Embed widget

Once an organization has set a **site slug** under `/admin/settings`, three
integration points become available:

1. **Hosted branded page** — `https://your-app.example.com/site/<slug>`
2. **Embed iframe content** — `https://your-app.example.com/embed/<slug>`
   (renders only the chat panel; chrome-free; designed to be iframed)
3. **One-line embed script** — drop a single `<script>` tag and the widget
   takes care of itself

The script-based embed is the recommended integration; it ships only ~5KB of
bootstrap JS and renders the chat inside an iframe served from this app, so
tenant-aware logic (RAG, RBAC, branding, persona) all runs server-side.

## One-line embed script

In `/admin/settings` → **Embed on your website** card → click **Copy**.
You'll get a snippet like:

```html
<script
  src="https://your-app.example.com/embed.js"
  data-site-slug="acme-support"
  async
></script>
```

Paste it inside the customer website's `<body>` (anywhere — the loader
appends its own DOM at the end of `body` on load).

### Attributes

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `data-site-slug` | yes | — | The org's site slug. Must match a row in `public.orgs.site_slug`. |
| `data-position` | no | `bottom-right` | Also accepts `bottom-left`. |
| `data-primary-color` | no | (org's `brandPrimaryColor` from admin) | Hex string like `#7c3aed`. Overrides the org-level color only inside the embedded panel; useful when a customer wants the widget to match their own site's accent. |
| `data-z-index` | no | `2147483646` | Integer. Bump if the host site has a higher-z element covering the bubble. |
| `async` | recommended | — | Standard HTML attribute. The loader does not block rendering. |

### Behaviour

- The bubble renders immediately. The chat iframe is **not** loaded until the
  visitor clicks the bubble (deferred load → no extra bytes for visitors who
  never open it).
- Pressing `Esc` closes the panel.
- Mobile: panel resizes to fill the screen minus margins.
- Anonymous: the iframe doesn't share auth with the host page; chat is
  tenant-scoped via `site_slug` resolution in `/api/chat`.

## Direct iframe (no JS)

If you can't or don't want to add a script tag, embed the page directly:

```html
<iframe
  src="https://your-app.example.com/embed/<slug>"
  title="Support chat"
  style="border:0;width:380px;height:560px;border-radius:18px;box-shadow:0 24px 64px rgba(15,23,42,.28);"
  loading="lazy"
></iframe>
```

You lose the floating bubble UX but gain a static integration that works in
any rich-text editor (e.g. CMS HTML blocks).

## Hosted page

Public, no sign-in:

```
https://your-app.example.com/site/<slug>
```

Shows the org's `brandName`, `brandTagline`, `brandLogoUrl`, and renders a
full-width branded chat. Use this for landing pages, knowledge-base footers,
or when you want a permalink for customers to share with their own users.

## How the pieces fit

```
customer-site.com
   └─ <script src=".../embed.js" data-site-slug="acme-support">
        ├─ injects: <button class="mts-chat-bubble">  (bottom-right)
        └─ injects: <iframe src="our-app.com/embed/acme-support">
                       └─ renders: <SupportChat siteSlug="acme-support" ... />
                            ├─ POST /api/chat  { message, siteSlug }
                            │     → resolves org_id from site_slug
                            │     → forwards to n8n with chat_config
                            │     → calls match_documents(tenant_org_id=org_id)
                            └─ renders org's branding + persona + greeting
```

All cross-tenant boundaries (RAG retrieval, branding, persona) are enforced
server-side. The host site only ships the loader script.

## Security headers

- `/embed/<slug>` is served with `Content-Security-Policy: frame-ancestors *`
  + `X-Frame-Options: ALLOWALL` so customer sites can iframe it.
- `/embed.js` is served with `Cache-Control: public, max-age=300` (5 min) and
  `Access-Control-Allow-Origin: *` so any origin can load it.
- The chat API itself runs same-origin (called from inside the iframe) so no
  CORS is needed for `/api/chat`.

## Operator checklist

Before pointing a customer at the embed:

- [ ] Org has at least one successful ingest job (else chat will say "no
      information yet").
- [ ] `documents.org_id` rows for that org exist in Supabase.
- [ ] `match_documents` RPC has the tenant-aware signature applied
      (migration `0003_match_documents_tenant.sql`).
- [ ] Public deploy URL is HTTPS.
- [ ] `CHAT_RATE_LIMIT_PER_MINUTE` is set to a sane value for the expected
      traffic.

## Future hardening (parking lot)

- **Allowed-origin allowlist.** Today the loader can be installed on any
  domain. To restrict to a customer's domain, add an `allowedOrigins`
  setting per org and validate the `Referer` / `Origin` server-side.
- **Per-site signed embed token.** Replace `site_slug` in the body with a
  short-lived HMAC token issued from `/admin/settings`, so the slug isn't a
  public secret.
- **PostMessage events.** Have the iframe `postMessage` lifecycle events
  ("session opened", "human handoff requested") back to the host page so
  customers can hook them into analytics.
