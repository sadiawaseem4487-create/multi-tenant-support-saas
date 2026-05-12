-- schema-v0.5-drop-legacy-match-documents.sql
-- Sprint 4 · Tenant safety hardening
--
-- Remove the legacy match_documents() variants that bypassed tenant isolation.
-- After migration 0003 was applied, three overloads coexisted in the database:
--
--   1. match_documents(query_embedding, match_count, company_name)
--      - filtered by metadata->>'company' only, no org scoping
--      - returned ALL chunks when company_name was null  (tenant leak)
--
--   2. match_documents(query_embedding, match_count, filter, tenant_org_id)
--      - fails CLOSED: returns zero rows when tenant_org_id is null
--      - the only correct signature; this is the one we keep
--
--   3. match_documents(query_embedding, match_threshold, match_count, filter, tenant_org_id)
--      - had `tenant_org_id is null OR d.org_id = tenant_org_id` permissive
--        fallback that also bypassed tenant scoping  (tenant leak)
--
-- This migration drops 1 and 3 so PostgREST has exactly one overload to
-- dispatch to. Any n8n caller still using the old company_name body
-- parameter will get a clear "function does not exist" error rather than
-- silently retrieving zero rows from a metadata mismatch.
--
-- Idempotent: uses "drop function if exists". Safe to re-apply.

drop function if exists public.match_documents(vector, integer, text);
drop function if exists public.match_documents(vector, double precision, integer, jsonb, uuid);

do $$
declare
  remaining int;
begin
  select count(*) into remaining
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'match_documents' and n.nspname = 'public';

  if remaining <> 1 then
    raise exception
      'expected exactly 1 match_documents() overload after cleanup, found %',
      remaining;
  end if;
end
$$;
