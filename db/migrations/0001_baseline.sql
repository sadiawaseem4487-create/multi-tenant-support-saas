-- schema-v0.sql — SaaS OLTP core (Postgres / Supabase compatible)
-- Apply in a dedicated project or alongside existing vector tables.
-- Sprint 0 (S0-6) · Sprint 1 wires auth subjects to `users.auth_subject`

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations (tenants)
-- ---------------------------------------------------------------------------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  site_slug text unique,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'enterprise')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orgs_site_slug_idx on public.orgs (site_slug) where site_slug is not null;

-- ---------------------------------------------------------------------------
-- Users (application identity; IdP links in Sprint 1)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  auth_provider text,
  auth_subject text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_lower_uidx on public.users (lower(email));
create index users_auth_subject_idx on public.users (auth_subject) where auth_subject is not null;

-- ---------------------------------------------------------------------------
-- Memberships (user ↔ org + role)
-- ---------------------------------------------------------------------------
create type public.membership_role as enum (
  'org_owner',
  'org_admin',
  'content_manager',
  'support_agent',
  'support_lead',
  'viewer'
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.membership_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index memberships_org_id_idx on public.memberships (org_id);
create index memberships_user_id_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  role public.membership_role not null default 'viewer',
  token_hash text not null,
  expires_at timestamptz not null,
  invited_by uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_org_email_idx on public.invitations (org_id, lower(email));

-- ---------------------------------------------------------------------------
-- Ingest jobs (n8n + API; vector pipeline status)
-- ---------------------------------------------------------------------------
create type public.ingest_job_status as enum (
  'queued',
  'running',
  'success',
  'failed'
);

create table public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  status public.ingest_job_status not null default 'queued',
  source text,
  payload jsonb not null default '{}'::jsonb,
  n8n_execution_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ingest_jobs_org_created_idx on public.ingest_jobs (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Knowledge base document registry (metadata; chunks may live in `documents`)
-- ---------------------------------------------------------------------------
create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  title text not null,
  source_uri text,
  external_id text,
  checksum text,
  ingest_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kb_documents_org_idx on public.kb_documents (org_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs (id) on delete set null,
  actor_user_id uuid references public.users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (org_id, created_at desc);
