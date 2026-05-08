# Staging Deploy Checklist (Vercel)

Use this before opening the app to internal testers.

## 1) Prepare staging services

- Create/confirm **separate staging** resources:
  - Clerk staging app (or Development instance dedicated to staging)
  - Supabase staging project/database
  - n8n staging workflows/webhook URLs
- Do not reuse production secrets in staging.

## 2) Vercel project setup

- Import `company-chat-ui` into Vercel.
- Framework preset: Next.js.
- Branch strategy:
  - Preview deployments on feature branches
  - One branch for staging (for example `staging`)

## 3) Required environment variables (Vercel)

Set these in Vercel project settings for the staging environment:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `N8N_WEBHOOK_URL`
- `INGEST_WEBHOOK_URL`
- `INVITE_WEBHOOK_URL` (optional but recommended)
- `WEBHOOK_SECRET` (same secret expected by n8n)
- `COMPANY_NAME`
- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_BRAND_TAGLINE`
- `BOOTSTRAP_ORG_SLUG` (optional override)
- `BOOTSTRAP_ORG_NAME` (optional override)
- `APP_BASE_URL` (set to your staging URL)

## 4) Clerk URL configuration

In Clerk for the staging app/instance:

- Allowed origin includes your staging URL.
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/admin`
- After sign-up URL: `/admin`
- After sign-out URL: `/`

## 5) Database sanity checks

- `schema-v0.sql` applied on staging DB.
- Tables present: `orgs`, `users`, `memberships`, `invitations`, `ingest_jobs`, `kb_documents`, `audit_logs`.
- Test `DATABASE_URL` against staging DB (not production).

## 6) n8n webhook checks

- `N8N_WEBHOOK_URL` workflow is active and returns `answer`/`Answer`.
- `INGEST_WEBHOOK_URL` workflow is active, accepts `job_id` + `org_id`, and starts ingest processing.
- Ingest workflow calls back `PATCH /api/internal/ingest-jobs/:jobId` with `X-Webhook-Secret` and status updates.
- `INVITE_WEBHOOK_URL` workflow is active and sends email.
- If `WEBHOOK_SECRET` is configured, n8n validates `X-Webhook-Secret`.
- Chat workflow input should read `org_id` (when provided) and pass it into vector retrieval filters (`match_documents` by tenant).
- Keep `correlation_id` in logs for request tracing from Next.js -> n8n.

## 7) Smoke test after deploy

- Public page loads on staging URL.
- Chat widget returns answer via `/api/chat`.
- `/admin` is protected by Clerk.
- First login creates/updates `public.users` and membership.
- `/admin/members` lists members and pending invitations.
- Creating invite shows email webhook delivery status.

## 8) Release metadata

- Record staging URL in sprint/backlog docs.
- Save deployment date and commit SHA in release notes.
- Confirm webhook secret rotation policy from `docs/WEBHOOK_SECURITY_ROTATION.md`.
