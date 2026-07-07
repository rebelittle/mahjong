-- Migration 0015: log of roster emails sent for each session, so the
-- scheduled GitHub Action (.github/workflows/session-email.yml) never
-- sends a duplicate even if a run is delayed or retried.
-- Run in Supabase SQL editor after 0014.

create table if not exists public.session_email_log (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  recipient  text not null
);

-- Only the service role (used by the GitHub Action) touches this table.
-- RLS on with no policies = invisible to anon/authenticated clients.
alter table public.session_email_log enable row level security;
