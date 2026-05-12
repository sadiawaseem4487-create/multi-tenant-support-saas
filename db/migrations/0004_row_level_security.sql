-- schema-v0.3-row-level-security.sql
-- Sprint 4 hardening (S4-?) · Defense in depth for tenant isolation.
--
-- The Next.js app uses the Supabase service role and trusts its own
-- `where org_id = ...` filters. RLS adds a second wall: even if a future
-- bug forgets the filter, the database will refuse the rows.
--
-- This migration:
--   1. Enables RLS on every tenant-scoped table.
--   2. Adds a session-local GUC `app.current_org_id` that the application
--      may set inside a transaction to scope queries.
--   3. Adds policies that allow access only when the row's `org_id`
--      matches `app.current_org_id`, OR when the connection is the
--      `service_role` (so admin scripts still work).
--   4. Provides a helper `set_current_org(orgId uuid)` that callers can
--      invoke inside `sql.begin(async tx => { ... })`.
--
-- IMPORTANT operational notes:
--   - postgres.js (the driver used by the app) opens new connections from a
--     pool; GUCs set outside a transaction may leak. ALWAYS scope via
--     `select set_current_org('...')` inside `sql.begin(...)`.
--   - The Supabase pooler runs PGBouncer in transaction mode; same rule:
--     wrap in a transaction.
--   - The Next.js admin code paths can continue to use service-role bypass
--     in the short term. New code SHOULD prefer the helper.
--   - `public.orgs` is left WITHOUT RLS so the chat webhook can look up
--     `site_slug -> org_id` for anonymous visitors. Treat it as public.

begin;

-- ---------------------------------------------------------------------------
-- 1. Helper: read current org id (returns null when unset)
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('app.current_org_id', true), '')::uuid
$$;

comment on function public.current_org_id() is
  'Returns the org_id set by set_current_org() for this session, or null.';

create or replace function public.set_current_org(p_org_id uuid)
returns void
language sql
as $$
  select set_config('app.current_org_id', coalesce(p_org_id::text, ''), true)
$$;

comment on function public.set_current_org(uuid) is
  'Sets app.current_org_id for the current transaction. Use inside sql.begin().';

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on tenant-scoped tables. service_role bypasses RLS by
--    default in Supabase; the policies below restrict everyone else.
-- ---------------------------------------------------------------------------
alter table public.memberships    enable row level security;
alter table public.invitations    enable row level security;
alter table public.ingest_jobs    enable row level security;
alter table public.kb_documents   enable row level security;
alter table public.documents      enable row level security;
alter table public.audit_logs     enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Policies: rows are visible iff org_id matches app.current_org_id.
--    Each table gets a single FOR ALL policy covering select/insert/update/delete.
-- ---------------------------------------------------------------------------
drop policy if exists tenant_scope on public.memberships;
create policy tenant_scope on public.memberships
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists tenant_scope on public.invitations;
create policy tenant_scope on public.invitations
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists tenant_scope on public.ingest_jobs;
create policy tenant_scope on public.ingest_jobs
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists tenant_scope on public.kb_documents;
create policy tenant_scope on public.kb_documents
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists tenant_scope on public.documents;
create policy tenant_scope on public.documents
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- audit_logs may have null org_id for platform-level events; allow only
-- service_role to read those, and constrain tenant-scoped rows normally.
drop policy if exists tenant_scope on public.audit_logs;
create policy tenant_scope on public.audit_logs
  using (org_id is not null and org_id = public.current_org_id())
  with check (org_id is not null and org_id = public.current_org_id());

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- As service_role (the app), RLS is bypassed; this should still return rows:
-- select count(*) from public.documents;

-- As a regular role without setting the GUC, this MUST return zero:
-- set role authenticated;
-- select count(*) from public.documents;          -- expect 0
-- select public.set_current_org('00000000-0000-0000-0000-000000000000'::uuid);
-- select count(*) from public.documents;          -- still 0 (no rows for that org)
-- reset role;

-- ---------------------------------------------------------------------------
-- Rollback (only if you need to disable RLS later)
-- ---------------------------------------------------------------------------
-- begin;
-- drop policy if exists tenant_scope on public.memberships;
-- drop policy if exists tenant_scope on public.invitations;
-- drop policy if exists tenant_scope on public.ingest_jobs;
-- drop policy if exists tenant_scope on public.kb_documents;
-- drop policy if exists tenant_scope on public.documents;
-- drop policy if exists tenant_scope on public.audit_logs;
-- alter table public.memberships    disable row level security;
-- alter table public.invitations    disable row level security;
-- alter table public.ingest_jobs    disable row level security;
-- alter table public.kb_documents   disable row level security;
-- alter table public.documents      disable row level security;
-- alter table public.audit_logs     disable row level security;
-- drop function if exists public.set_current_org(uuid);
-- drop function if exists public.current_org_id();
-- commit;
