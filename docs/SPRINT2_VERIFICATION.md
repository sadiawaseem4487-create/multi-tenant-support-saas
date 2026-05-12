# Sprint 2 verification checklist

Use this checklist to certify the Sprint 2 exit criterion:

> **Org A cannot retrieve Org B chunks; ingest failure surfaces in admin UI.**

Run against the **staging** Supabase + n8n + Next.js deploy.

## Quick path (recommended)

Most of the prep is now automated via `npm` scripts:

```bash
# From ~/company-chat-ui
npm run rotate:secrets                       # prints fresh WEBHOOK_SECRET + paste-in checklist
npm run db:migrate:status                    # shows which SQL migrations are applied
npm run db:migrate                           # applies pending required migrations (0003)
npm run db:backfill-docs-org -- --slug demo-company   # stamp legacy chunks (optional)
npm run verify:tenant-isolation              # asserts the security boundary at the DB level
```

Then walk the manual sections below for end-to-end checks against the live app.

## Prerequisites

### Database
- [ ] `npm run db:migrate:status` shows `0001_baseline.sql` and `0002_alter_vectors.sql` as applied.
- [ ] `npm run db:migrate` ran without errors and now `0003_match_documents_tenant.sql` is applied.
- [ ] Decided backfill strategy for legacy `documents` rows:
  - **Stamp them onto a demo org:** `npm run db:backfill-docs-org -- --slug demo-company`
  - **Drop them:** run the `delete from public.documents where org_id is null` block in `db/migrations/0003_match_documents_tenant.sql`.
- [ ] (Optional, defense-in-depth) `npm run db:migrate:rls` to apply `0004_row_level_security.sql`. **Only do this once `lib/db.ts` wraps tenant queries in a transaction that calls `set_current_org(orgId)` first**, otherwise the app will return zero rows.

### Secrets
- [ ] `npm run rotate:secrets` was run and the printed values were pasted into:
  - Vercel env (Production + Preview) → `WEBHOOK_SECRET`
  - n8n env → `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`
  - Local `.env.local` → `WEBHOOK_SECRET`
- [ ] Vercel redeployed after the env change.

### n8n
- [ ] n8n ingest workflow imported from `~/company costumer service/docs/n8n/ingest-workflow.template.json` and customized for your source loader + credentials.
- [ ] n8n chat/RAG workflow imported from `~/company costumer service/docs/n8n/chat-rag-workflow.template.json` and credentials wired.
- [ ] n8n env vars set: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`, `APP_BASE_URL`, `DEFAULT_ORG_ID`.

### Next.js
- [ ] `INGEST_WEBHOOK_URL`, `N8N_WEBHOOK_URL` configured in Vercel.
- [ ] `WEBHOOK_SECRET` matches the value pasted into n8n.

## 1. Provision two test orgs

- [ ] Sign up user A → bootstraps `org_a` (via `lib/auth-sync.ts`). Note org_id A: `____________________`.
- [ ] Sign up user B in a different Clerk session → bootstraps `org_b`. Note org_id B: `____________________`.
- [ ] Confirm in Supabase:
  ```sql
  select id, slug, name from public.orgs order by created_at desc limit 5;
  select user_id, org_id, role from public.memberships order by created_at desc limit 5;
  ```

## 2. Per-tenant ingest

- [ ] As user A, navigate to `/admin/knowledge`, trigger **Start ingest** with content unique to org A (e.g. "Org A's secret product is Apricots").
- [ ] As user B, do the same with content unique to org B (e.g. "Org B's secret product is Blueberries").
- [ ] In Supabase:
  ```sql
  select org_id, count(*) from public.documents group by org_id;
  ```
  Both org ids should appear with > 0 chunks each. **No nulls in the new rows.**
- [ ] `ingest_jobs` for each org transitioned `queued → running → success`. `n8n_execution_id` populated.

## 3. Cross-tenant chat isolation — the security boundary

- [ ] Signed in as user A, ask: *"What is the secret product?"* → answer references Apricots, NOT Blueberries.
- [ ] Signed in as user B, ask: *"What is the secret product?"* → answer references Blueberries, NOT Apricots.
- [ ] Run `npm run verify:tenant-isolation` and confirm all four checks PASS. This covers:
  - function signature includes `tenant_org_id`
  - fail-closed: null tenant returns zero rows
  - real org returns chunks and every returned row belongs to that org
  - random non-existent UUID returns zero rows

If you prefer to spot-check by hand in the Supabase SQL editor:

```sql
-- Cross-tenant retrieval must return zero
select count(*) from public.match_documents(
  (select embedding from public.documents where org_id = '<A>' limit 1),
  5, '{}'::jsonb, '<B>'::uuid
);

-- Fail-closed
select count(*) from public.match_documents(
  (select embedding from public.documents limit 1),
  5, '{}'::jsonb, null
);
```

## 4. Ingest failure surfaces in admin UI

Pick one method to force a failure:

- **Option A:** Temporarily set `INGEST_WEBHOOK_URL` to an invalid URL in Next.js env, redeploy, click Start ingest.
- **Option B:** In n8n, set a wrong `WEBHOOK_SECRET` in the env briefly so the verify-secret IF branch returns 401.
- **Option C:** Break one node in the ingest workflow (rename a referenced field) and retrigger.

- [ ] Trigger an ingest that fails by your chosen method.
- [ ] In Supabase: `select status, error from public.ingest_jobs order by created_at desc limit 1;` → status `failed`, error column non-null.
- [ ] In `/admin/knowledge`: most recent row shows the failure with the error message visible.

## 5. Cleanup

- [ ] Restore any temporarily broken config.
- [ ] (Optional) Remove test orgs/users from staging once captured.

## Sign-off

| Tester | Date | Outcome |
|--------|------|---------|
|  |  | ☐ Pass ☐ Fail |

Once all boxes are checked, mark `S2-1`, `S2-2`, `S2-3`, `S2-4` as Done in
`~/company costumer service/docs/SPRINT_BACKLOG.md` and close Sprint 2.
