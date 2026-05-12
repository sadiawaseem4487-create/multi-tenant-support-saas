-- schema-v0.2-match-documents-tenant.sql
-- Sprint 2 · S2-1 · Enforce tenant isolation on RAG retrieval.
--
-- Run AFTER schema-v0-alter-vectors.sql on the same database that stores
-- vector embeddings (Supabase).
--
-- Effects:
--   1. Ensures public.documents.org_id exists (idempotent with prior alter).
--   2. Replaces public.match_documents to accept tenant_org_id uuid.
--   3. Fails CLOSED: when tenant_org_id is null, returns zero rows so a
--      misconfigured caller can never leak across tenants.
--
-- After applying, the n8n chat/RAG workflow must pass tenant_org_id from
-- the incoming webhook (`org_id` field) into match_documents.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ensure org_id column + index exist on public.documents
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists org_id uuid references public.orgs (id) on delete cascade;

create index if not exists documents_org_id_idx on public.documents (org_id);

comment on column public.documents.org_id is
  'Tenant that owns this chunk. match_documents must filter on this column.';

-- ---------------------------------------------------------------------------
-- 2. Replace match_documents with a tenant-aware signature.
--    We drop the prior 3-arg signature explicitly so the replacement is
--    unambiguous regardless of how the original was authored.
-- ---------------------------------------------------------------------------
drop function if exists public.match_documents(vector, int, jsonb);
drop function if exists public.match_documents(vector(1536), int, jsonb);

create or replace function public.match_documents (
  query_embedding vector(1536),
  match_count int default 5,
  filter jsonb default '{}'::jsonb,
  tenant_org_id uuid default null
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where
    tenant_org_id is not null
    and d.org_id = tenant_org_id
    and d.metadata @> coalesce(filter, '{}'::jsonb)
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on function public.match_documents(vector(1536), int, jsonb, uuid) is
  'Tenant-scoped semantic search. Fails closed: returns empty when tenant_org_id is null.';

commit;

-- ---------------------------------------------------------------------------
-- OPTIONAL: backfill existing rows whose org_id is null.
-- Pick ONE strategy and run separately. Both are commented out by default.
-- ---------------------------------------------------------------------------

-- Strategy A: assign all legacy rows to a single default org (e.g. NovaMart demo).
-- update public.documents
-- set org_id = (select id from public.orgs where slug = 'demo-company' limit 1)
-- where org_id is null;

-- Strategy B: delete legacy rows that have no tenant; re-ingest per tenant.
-- delete from public.documents where org_id is null;

-- ---------------------------------------------------------------------------
-- Verification queries (run manually after applying)
-- ---------------------------------------------------------------------------

-- Count rows without a tenant:
-- select count(*) as orphan_chunks from public.documents where org_id is null;

-- Confirm function signature exists:
-- select pg_get_functiondef(p.oid)
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'match_documents';

-- Smoke test: this MUST return zero rows (fail-closed on null tenant).
-- select count(*) from public.match_documents(
--   (select embedding from public.documents limit 1),
--   5,
--   '{}'::jsonb,
--   null
-- );
