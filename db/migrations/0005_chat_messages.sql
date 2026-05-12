-- schema-v0.4-chat-messages.sql
-- Sprint 4 · Conversation Analytics
--
-- Logs every chat request (one row per question) so /admin/analytics can
-- show volume, fallback rate, top questions, and recent transcripts per org.
--
-- Safe to apply alongside the tenant-isolation migration (0003) and the
-- optional RLS migration (0004). All rows carry org_id explicitly and rely
-- on it for filtering.

create extension if not exists pgcrypto;

create table if not exists public.chat_messages (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs(id) on delete cascade,
  question            text not null,
  question_normalized text not null,
  answer              text,
  was_fallback        boolean not null default false,
  response_ms         integer,
  status              text not null default 'ok',
  source              text not null default 'authenticated',
  correlation_id      text,
  visitor_ip_hash     text,
  user_auth_subject   text,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index if not exists chat_messages_org_created_idx
  on public.chat_messages (org_id, created_at desc);

create index if not exists chat_messages_org_normalized_idx
  on public.chat_messages (org_id, question_normalized);

create index if not exists chat_messages_org_fallback_idx
  on public.chat_messages (org_id, was_fallback)
  where was_fallback = true;

create index if not exists chat_messages_org_status_idx
  on public.chat_messages (org_id, status)
  where status <> 'ok';
