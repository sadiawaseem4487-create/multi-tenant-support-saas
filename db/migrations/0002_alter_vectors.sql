-- schema-v0-alter-vectors.sql — align existing RAG `documents` table with tenants
-- Run AFTER schema-v0.sql on the same database that stores vector embeddings.
--
-- Your current table is assumed to be public.documents(content, metadata, embedding).
-- This adds org scoping for Sprint 2 isolation.

alter table public.documents
  add column if not exists org_id uuid references public.orgs (id) on delete cascade;

create index if not exists documents_org_id_idx on public.documents (org_id);

-- Backfill example (single-tenant migration): create one org, then:
-- update public.documents set org_id = '<that-org-uuid>' where org_id is null;

comment on column public.documents.org_id is 'Tenant that owns this chunk; RPC match_documents must filter by org_id.';

-- Example RPC update (adjust dimensions/types to your existing function signature):
-- This enforces tenant isolation at retrieval time.
--
-- create or replace function public.match_documents (
--   query_embedding vector(1536),
--   match_count int,
--   filter jsonb default '{}'::jsonb,
--   tenant_org_id uuid default null
-- ) returns table (
--   id bigint,
--   content text,
--   metadata jsonb,
--   similarity float
-- )
-- language sql stable
-- as $$
--   select
--     d.id,
--     d.content,
--     d.metadata,
--     1 - (d.embedding <=> query_embedding) as similarity
--   from public.documents d
--   where
--     (tenant_org_id is null or d.org_id = tenant_org_id)
--     and d.metadata @> filter
--   order by d.embedding <=> query_embedding
--   limit greatest(match_count, 1);
-- $$;
