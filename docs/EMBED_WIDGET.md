# Embed widget snippet

**Sprint 3 · S3-4**

Once an organization has set a **site slug** under `/admin/settings`, two integration
points become available:

1. A hosted, branded support page at `https://your-app.example.com/site/<slug>`.
2. A standalone iframe embed you can drop into any HTML page.

There is no separate JavaScript bundle yet — the embed is a small HTML snippet that
loads the hosted page in an iframe with brand-safe styling. This keeps the host page
isolated from our CSS/JS and avoids cross-origin script execution.

## Hosted page

Anyone can visit this URL — no sign-in required. The page renders the org's brand
name, tagline, logo (if configured), and a chat that talks to the org's knowledge base.

```
https://your-app.example.com/site/<slug>
```

## Iframe embed

Paste this near the end of `<body>` on the customer's website. Replace `your-app.example.com`
with this app's public hostname and `<slug>` with the org's site slug.

```html
<!-- multi-tenant-support-saas: floating support widget -->
<style>
  .mtss-widget-trigger {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483646;
    width: 56px;
    height: 56px;
    border-radius: 9999px;
    border: 0;
    background: linear-gradient(135deg, #14b8a6, #0891b2);
    color: #fff;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
  }
  .mtss-widget-frame {
    position: fixed;
    right: 24px;
    bottom: 96px;
    z-index: 2147483647;
    width: min(380px, calc(100vw - 32px));
    height: min(620px, calc(100vh - 120px));
    border: 0;
    border-radius: 18px;
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.3);
    background: #ffffff;
    display: none;
  }
  .mtss-widget-frame.is-open { display: block; }
</style>
<button type="button" class="mtss-widget-trigger" aria-label="Open support chat"
        onclick="document.getElementById('mtss-widget').classList.toggle('is-open')">?</button>
<iframe id="mtss-widget" class="mtss-widget-frame"
        title="Support chat"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        src="https://your-app.example.com/site/<slug>"></iframe>
```

That's the whole integration. The host page only needs to add a button + an iframe —
no scripts, no SDK, no cross-origin auth. The chat runs entirely on this app's
domain and uses the org's `site_slug` to look up the right knowledge base on the
server.

## Behaviour

- **Anonymous users only.** The iframe doesn't share auth state with the host site.
- **Org resolution.** `/api/chat` reads `siteSlug` from the request body and looks up
  `public.orgs.site_slug → id`. The chat workflow is called with that `org_id`.
- **Rate limiting.** The chat is throttled per visitor IP by `CHAT_RATE_LIMIT_PER_MINUTE`
  (default 30/minute). Signed-in admins get their own per-user bucket.
- **Tenant isolation.** Retrieval calls `match_documents` with `tenant_org_id = <org>`,
  which fails closed if missing. Visitors of Org A cannot retrieve Org B's chunks.
- **Branding.** The page renders the org's `brandName`, `brandTagline`, and `brandLogoUrl`
  if set (from `/admin/settings`); otherwise it falls back to the org's name + a
  default tagline.

## Operator checklist

Before pointing a customer at `/site/<slug>`:

- [ ] Org has at least one successful ingest job (else chat will say "no information yet").
- [ ] `documents.org_id` rows for that org exist in Supabase.
- [ ] `match_documents` RPC has the tenant-aware signature applied.
- [ ] Public deploy URL is HTTPS.
- [ ] `CHAT_RATE_LIMIT_PER_MINUTE` is set to a sane value for the expected traffic.

## Future hardening (parking lot)

- **Allowed-origin allowlist.** Today the iframe can be embedded anywhere. To restrict
  to a customer's domain, add an `Allowed-Origins` setting per org and a CSP header.
- **Per-site signed embed token.** Replace `site_slug` in the body with a short-lived
  HMAC token issued from `/admin/settings`, so the slug isn't a public secret.
- **Standalone JS bundle.** A `<script>` snippet that mounts the iframe and posts
  events back to the host page (e.g. "session opened", "ticket created").
