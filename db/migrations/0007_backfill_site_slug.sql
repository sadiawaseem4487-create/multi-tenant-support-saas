-- Backfill site_slug from org slug when unset (enables /site/[slug] for existing tenants).
update public.orgs
set site_slug = slug
where site_slug is null
  and slug is not null;
