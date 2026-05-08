# Engineering guide — company-chat-ui

## Product program (source of truth)

Canonical **SaaS plan** and **sprint backlog** live in the program workspace:

`/Users/rnt998/company costumer service/docs/SAAS_PRODUCT_PLAN.md`  
`/Users/rnt998/company costumer service/docs/SPRINT_BACKLOG.md`

If paths differ on your machine, open the `company costumer service` repo and read `docs/`.

## Current app layout

| Path | Role |
|------|------|
| `app/page.tsx` | Public marketing + floating chat |
| `app/admin/*` | Admin console (Clerk required via `proxy.ts`) |
| `app/admin/members/page.tsx` | Org member list (RBAC: `users:read`) |
| `app/admin/knowledge/page.tsx` | Ingest launch + job history UI (RBAC: `kb:read`, `kb:write`) |
| `app/api/admin/members/route.ts` | Members/invite data API (`users:read`) |
| `app/api/admin/invitations/route.ts` | Invitation API (`users:invite`) |
| `app/api/orgs/[orgId]/ingest/route.ts` | Create ingest job + dispatch n8n workflow (`kb:write`) |
| `app/api/internal/ingest-jobs/[jobId]/route.ts` | n8n callback to update ingest job status (`PATCH`, webhook-secret protected) |
| `app/sign-in`, `app/sign-up` | Clerk hosted auth routes |
| `app/api/chat/route.ts` | Server proxy to n8n webhook (`question`, `company_name`, `org_id`, `correlation_id`) |
| `proxy.ts` | `auth.protect()` for `/admin` only |
| `lib/auth-sync.ts` | Upsert `public.users`, bootstrap org + `org_owner` membership |
| `lib/rbac.ts` | `getPrimaryMembership`, `requireRole(orgId, perm, authSubject)` |
| `lib/db.ts` | `postgres.js` client (`DATABASE_URL`, `prepare: false` for poolers) |
| `components/FloatingChatWidget.tsx` | Floating support UI |
| `components/SupportChat.tsx` | Chat logic + suggestions |
| `components/CompanyMarketing.tsx` | Demo storefront content |
| `components/PublicNavAuth.tsx` | Sign-in / Console / `UserButton` on marketing header |

## Target layout (Sprint 1+)

```
app/
  (public)/           # optional route group: marketing, widget embed
  (admin)/            # admin console (auth required)
    layout.tsx
    page.tsx
    members/
    knowledge/
  api/
    chat/             # public or site-key scoped
    internal/         # org-scoped admin APIs
```

**`/admin`** is protected by Clerk; the admin layout syncs the signed-in user to Postgres and attaches them to `BOOTSTRAP_ORG_SLUG` (default `demo-company`) as `org_owner` when they have no memberships.
**RBAC:** `lib/rbac.ts` enforces role permissions server-side (current usage: `users:read` on `/admin/members`).
**Tenant chat context:** when a signed-in user calls `/api/chat`, the route resolves organization context and forwards `org_id` to n8n so vector retrieval can be scoped per tenant.
**Invites:** `/api/admin/invitations` writes invitation tokens to `public.invitations`; `/admin/members` includes invite form + pending invite list.
If `INVITE_WEBHOOK_URL` is set, the API also POSTs invite payload to n8n (reuses `WEBHOOK_SECRET` as optional `X-Webhook-Secret` header).
Manual verification matrix: `docs/RBAC_MANUAL_TEST_MATRIX.md`.

## Environment variables

See `.env.example`. Public branding uses `NEXT_PUBLIC_*`. Server-only secrets must never be prefixed with `NEXT_PUBLIC_`.

## Conventions

- **Tenant context:** eventual middleware sets `orgId` from session; all server mutations check RBAC.
- **n8n:** call webhooks with `X-Webhook-Signature` (or IdP) once Sprint 2 hardens integrations.

## Database (Sprint 0 v0)

OLTP + vector alignment SQL lives in the program repo:

- `docs/schema-v0.sql` — `orgs`, `users`, `memberships`, `invitations`, `ingest_jobs`, `kb_documents`, `audit_logs`
- `docs/schema-v0-alter-vectors.sql` — add `org_id` to existing `documents` vector table
- `docs/DATA_MODEL.md` — ERD (Mermaid)

**Next.js:** set `DATABASE_URL` (Supabase pooler URI recommended). The app uses `postgres.js` for the admin identity sync only; add Drizzle/Prisma later if you want typed queries.

## Related

- n8n workflows: document IDs in program repo or internal wiki when stable.
- staging deployment runbook: `docs/STAGING_DEPLOY_CHECKLIST.md`.
- webhook auth/rotation runbook: `docs/WEBHOOK_SECURITY_ROTATION.md`.
