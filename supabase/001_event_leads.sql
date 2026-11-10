-- Run ONCE in Supabase SQL Editor, after reviewing your project.
-- No public read/write policies: browser visitors never access this table directly.
create extension if not exists pgcrypto;
create table if not exists public.event_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  phone text not null,
  event_type text not null check (event_type in ('corporate','company-day','private','birthday','concert','other')),
  description text not null,
  city text not null,
  event_date date,
  guests text,
  budget text,
  services text[] not null default '{}',
  consent_version text not null,
  consented_at timestamptz not null,
  source_path text,
  status text not null default 'new' check (status in ('new','contacted','quoted','won','lost','archived')),
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed','not_configured')),
  internal_notes text
);
create index if not exists event_leads_created_at_idx on public.event_leads(created_at desc);
create index if not exists event_leads_status_idx on public.event_leads(status);
alter table public.event_leads enable row level security;
-- Ensure anon/authenticated cannot see, insert, change or delete private contact data.
revoke all on table public.event_leads from anon, authenticated;
-- The Cloudflare backend alone uses SUPABASE_SECRET_KEY. That key maps to service_role.
grant all on table public.event_leads to service_role;
-- No RLS policies intentionally: service_role bypasses RLS, others denied.
-- Optional retention (manual):
-- delete from public.event_leads where created_at < now() - interval '12 months' and status in ('lost','archived');
