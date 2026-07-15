-- Migration 0016: log of signup-confirmation emails sent to guests, so the
-- scheduled GitHub Action (.github/workflows/signup-confirmation-email.yml)
-- emails each guest exactly once per session — switching seats within the
-- same session does not trigger a second email.
-- Run in Supabase SQL editor after 0015.

create table if not exists public.signup_email_log (
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  recipient  text not null,
  primary key (session_id, profile_id)
);

-- Backfill: everyone already signed up before this feature existed should
-- not receive a retroactive confirmation on the script's first run.
insert into public.signup_email_log (session_id, profile_id, recipient)
select s.session_id, s.profile_id, p.email || ' (backfill, not sent)'
from public.seats s
join public.profiles p on p.id = s.profile_id
where s.profile_id is not null
on conflict do nothing;

-- Only the service role (used by the GitHub Action) touches this table.
-- RLS on with no policies = invisible to anon/authenticated clients.
alter table public.signup_email_log enable row level security;
