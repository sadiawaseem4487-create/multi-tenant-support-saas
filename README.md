# company-chat-ui

Multi-tenant SaaS support chat. Organizations sign up, ingest their own knowledge base,
and serve answers from a shared RAG pipeline scoped per tenant.

Live demo: <https://multi-tenant-support-saas.vercel.app>

## What this is

- **Public marketing site** with a floating chat widget on `/`.
- **Admin console** at `/admin` (members, organizations, knowledge ingest jobs, settings).
- **Server proxy** to an n8n RAG workflow on Supabase pgvector.
- **Per-tenant isolation** via `documents.org_id` + a tenant-aware `match_documents` RPC.

The product office (vision, sprints, schema migrations, n8n workflow exports) lives in a
sibling repo: `../company costumer service/`.

## Architecture

```
                              ┌─────────────────────────────┐
                              │     Browser (Clerk auth)    │
                              └─────────────┬───────────────┘
                                            │
                              ┌─────────────▼───────────────┐
                              │      Next.js (this repo)    │
                              │   - /admin   - /api/chat    │
                              │   - /api/orgs/:id/ingest    │
                              └──────┬──────┬───────────────┘
                                     │      │
              Postgres (Supabase pooler)    │  HTTPS w/ X-Webhook-Secret
                                     │      ▼
                              ┌──────▼────────────────┐
                              │       n8n Cloud       │
                              │   chat + ingest flows │
                              └──────────┬────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │   Supabase Postgres   │
                              │   orgs / users /      │
                              │   memberships /       │
                              │   ingest_jobs /       │
                              │   documents (vectors) │
                              └───────────────────────┘
```

## Stack

| Concern | Choice |
|--------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Auth | Clerk |
| DB | Supabase Postgres + pgvector (`postgres.js` driver) |
| Embeddings & LLM | OpenRouter (text-embedding-3-small + gpt-4.1-mini) |
| Automation | n8n Cloud (chat RAG + ingest + invite email) |
| Hosting | Vercel |
| Styling | Tailwind CSS v4 |

## Folder layout

```
app/
  page.tsx                    Public marketing + floating chat
  admin/
    layout.tsx                Auth gate + org switcher + user menu
    page.tsx                  Admin home
    members/                  Members + invite UI
    organizations/            Org list + create
    knowledge/                Ingest trigger + job history
  api/
    chat/route.ts             Server proxy to n8n chat webhook
    admin/...                 Org-scoped admin APIs (RBAC enforced)
    orgs/[orgId]/ingest/      Ingest dispatcher
    internal/ingest-jobs/     n8n status callback (webhook-secret protected)
    invitations/accept/       Token-based invitation acceptance
  sign-in, sign-up            Clerk hosted auth
  accept-invite/              Invite acceptance landing
components/
  SupportChat.tsx             Chat logic + suggestions
  FloatingChatWidget.tsx      Public floating widget
  CompanyMarketing.tsx        Demo storefront content
  admin/                      Admin panels & forms
lib/
  db.ts                       postgres.js client (DATABASE_URL)
  rbac.ts                     Roles + permissions + requireRole helper
  auth-sync.ts                Clerk → public.users + first-user bootstrap
proxy.ts                      Clerk middleware (protects /admin/*)
docs/                         Engineering, deploy, RBAC, webhook security
```

## Local setup

Prerequisites: Node 20+, a Clerk dev project, a Supabase project (or any Postgres with
pgvector), an n8n instance (Cloud or self-hosted), and an OpenRouter key.

```bash
cp .env.example .env.local        # then fill in the values below
npm install
npm run dev                       # http://localhost:3000
```

### Required environment variables

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend |
| `CLERK_SECRET_KEY` | Clerk backend |
| `DATABASE_URL` | Supabase pooler URI (`prepare: false`-friendly) |
| `N8N_WEBHOOK_URL` | n8n chat RAG webhook endpoint |
| `INGEST_WEBHOOK_URL` | n8n manual-ingest webhook endpoint |
| `INVITE_WEBHOOK_URL` | n8n invite email webhook endpoint (optional) |
| `WEBHOOK_SECRET` | Shared secret with n8n (`X-Webhook-Secret` header) |
| `COMPANY_NAME` | Fallback brand name when no org context |
| `NEXT_PUBLIC_BRAND_NAME` | Public marketing site name |
| `NEXT_PUBLIC_BRAND_TAGLINE` | Public marketing site tagline |
| `BOOTSTRAP_ORG_SLUG` / `BOOTSTRAP_ORG_NAME` | First-user bootstrap org (default `demo-company`) |
| `ALLOW_AUTO_BOOTSTRAP_ALL_USERS` | `true` to bootstrap every new user into the same org (dev only) |

### Database

Schema files live in the program repo:

- `../company costumer service/docs/schema-v0.sql` — orgs, users, memberships, invitations, ingest_jobs, kb_documents, audit_logs.
- `../company costumer service/docs/schema-v0-alter-vectors.sql` — adds `org_id` to the vector `documents` table.
- `../company costumer service/docs/schema-v0.2-match-documents-tenant.sql` — tenant-aware `match_documents` RPC (fail-closed on null tenant).

Apply in that order against your Supabase project.

### n8n workflows

Versioned templates + narratives also in the program repo under `docs/n8n/`:

- `ingest-webhook-tenant-aware.patched.json` — production-ready export of all four flows
  (Drive ingest, chat RAG, invite email, manual ingest dispatcher).
- `INGEST_WORKFLOW.md`, `CHAT_RAG_WORKFLOW.md`, `PATCH_NOTES.md` — design and rollout
  references.

Set these n8n environment variables before activating:

| Name | Purpose |
|------|---------|
| `OPENROUTER_API_KEY` | LLM + embeddings |
| `SUPABASE_SERVICE_ROLE_KEY` | RPC call to `match_documents` |
| `WEBHOOK_SECRET` | Must match the Next.js value |
| `APP_BASE_URL` | Public URL for status callbacks (e.g. Vercel deploy) |
| `DEFAULT_ORG_ID` | UUID of the org that owns the Drive-trigger folder |

## Scripts

```bash
# Dev / build
npm run dev      # next dev (Turbopack)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint

# Database (operates on DATABASE_URL from .env.local)
npm run db:migrate:status     # show applied vs pending SQL migrations
npm run db:migrate            # apply pending required migrations
npm run db:migrate:rls        # also apply optional RLS migration (0004)
npm run db:migrate:mark FILE  # mark a migration as applied without running
npm run db:backfill-docs-org -- --slug demo-company   # stamp legacy chunks
                                                       # (use --dry-run first)

# Sprint 2 verification
npm run verify:tenant-isolation   # asserts tenant boundary at the DB level
npm run rotate:secrets            # prints fresh WEBHOOK_SECRET + paste-in steps
```

SQL migrations live in `db/migrations/` (synced from `~/company costumer service/docs/schema-v*.sql`).

## Operational docs (`docs/`)

- `ENGINEERING.md` — engineering guide (app layout, conventions, env, related repos).
- `STAGING_DEPLOY_CHECKLIST.md` — staging runbook.
- `RBAC_MANUAL_TEST_MATRIX.md` — role × permission verification matrix.
- `WEBHOOK_SECURITY_ROTATION.md` — webhook secret rotation runbook.
- `N8N_CREDENTIALS_SETUP.md` — move OpenRouter/Supabase/webhook secret into n8n credentials.
- `N8N_INGEST_RETRY.md` — ingest failure handling and retry runbook.
- `SENTRY_SETUP.md` — optional Sentry DSN setup.
- `RLS_OPTIONAL.md` — optional Row-Level Security migration.
- `CLERK_BRANDING_CHECKLIST.md` — Clerk dashboard branding steps.
- `SPRINT2_VERIFICATION.md` — Sprint 2 exit-criteria checklist (tenant isolation).

## Sprint status (at time of this README)

| Sprint | Goal | Status |
|--------|------|--------|
| 0 | Foundations | Done |
| 1 | Multi-tenant auth, RBAC, invites | Done |
| 2 | Per-tenant KB, ingest jobs, n8n contracts | Done (live) |
| 3 | Public branded sites, embed, analytics | Done |
| 4 | Observability & reliability | In progress (Sentry optional; KB status dashboard shipped) |
| 5 | Stripe billing | Not started |
| 6 | Enterprise (SSO, audit export) | Partial (`/admin/audit` viewer) |

Source of truth: `../company costumer service/docs/SPRINT_BACKLOG.md`.

## License

Private — not open source. Contact the maintainer before reusing.
