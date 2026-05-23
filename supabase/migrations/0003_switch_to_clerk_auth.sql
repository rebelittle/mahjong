-- Migration 0003: switch authentication from Supabase Auth → Clerk
--
-- Run this in the Supabase SQL editor. It DROPS the tables created by
-- 0001/0002 and recreates them with text identifiers (Clerk user IDs are
-- strings like `user_2abc...`, not UUIDs) and RLS policies that read the
-- Clerk JWT directly via `auth.jwt() ->> 'sub' | 'email'`.
--
-- Prereq: enable Clerk as a third-party auth provider in
-- Supabase dashboard → Auth → Sign In / Up → Third Party Auth → Clerk,
-- then paste the issuer URL from Clerk dashboard → Integrations → Supabase.

------------------------------------------------------------------------
-- Tear down old schema (test data only — confirmed safe to wipe).
-- Tables MUST drop before is_admin(): their RLS policies depend on it,
-- and `drop table cascade` removes the policies (which removes the
-- dependency) but `drop function` itself errors out otherwise.
------------------------------------------------------------------------
drop table if exists public.seats cascade;
drop table if exists public.sessions cascade;
drop table if exists public.session_templates cascade;
drop table if exists public.admins cascade;
drop table if exists public.profiles cascade;

drop function if exists public.claim_seat(uuid) cascade;
drop function if exists public.ensure_sessions_materialized(int) cascade;
drop function if exists public.generate_seats_for_session() cascade;
drop function if exists public.is_admin() cascade;

------------------------------------------------------------------------
-- Profiles: one row per Clerk user. id is the Clerk user ID (text).
------------------------------------------------------------------------
create table public.profiles (
  id            text primary key,
  email         text not null,
  display_name  text not null,
  photo_url     text,
  skill_level   text check (skill_level in ('beginner', 'intermediate', 'advanced')),
  notes         text,
  is_helper     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

------------------------------------------------------------------------
-- Admins: emails granted admin powers (matched against Clerk JWT email)
------------------------------------------------------------------------
create table public.admins (
  email text primary key
);

insert into public.admins (email)
values ('reaganlittle05@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where a.email = (auth.jwt() ->> 'email')
  );
$$;

------------------------------------------------------------------------
-- Session templates: the recurring weekly schedule
------------------------------------------------------------------------
create table public.session_templates (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('mommy', 'beginner', 'experienced')),
  day_of_week  int  not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  active       boolean not null default true
);

insert into public.session_templates (type, day_of_week, start_time, end_time) values
  ('mommy',       2, '10:00', '12:00'),
  ('beginner',    3, '13:00', '15:00'),
  ('experienced', 4, '10:00', '12:00');

------------------------------------------------------------------------
-- Sessions: concrete instances (one per week per template)
------------------------------------------------------------------------
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid references public.session_templates(id) on delete set null,
  type         text not null check (type in ('mommy', 'beginner', 'experienced')),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'open' check (status in ('open', 'cancelled')),
  notes        text,
  created_at   timestamptz not null default now()
);

create index sessions_starts_at_idx on public.sessions (starts_at);

------------------------------------------------------------------------
-- Seats: 4 tables × 4 positions per session. profile_id is Clerk user ID.
------------------------------------------------------------------------
create table public.seats (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  table_number   int  not null check (table_number between 1 and 4),
  seat_position  text not null check (seat_position in ('east', 'south', 'west', 'north')),
  profile_id     text references public.profiles(id) on delete set null,
  reserved_at    timestamptz,
  unique (session_id, table_number, seat_position),
  unique (session_id, profile_id)
);

create index seats_session_idx on public.seats (session_id);

create or replace function public.generate_seats_for_session()
returns trigger
language plpgsql
as $$
declare
  t int;
  positions text[] := array['east', 'south', 'west', 'north'];
  p text;
begin
  for t in 1..4 loop
    foreach p in array positions loop
      insert into public.seats (session_id, table_number, seat_position)
      values (new.id, t, p);
    end loop;
  end loop;
  return new;
end;
$$;

create trigger generate_seats_after_session_insert
after insert on public.sessions
for each row execute function public.generate_seats_for_session();

------------------------------------------------------------------------
-- Row-Level Security (Clerk JWT — sub claim is the Clerk user ID)
------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.admins            enable row level security;
alter table public.session_templates enable row level security;
alter table public.sessions          enable row level security;
alter table public.seats             enable row level security;

create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles insert" on public.profiles for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = id);
create policy "profiles update" on public.profiles for update to authenticated
  using ((auth.jwt() ->> 'sub') = id or public.is_admin());
create policy "profiles delete" on public.profiles for delete to authenticated
  using (public.is_admin());

create policy "admins read"  on public.admins for select to authenticated using (public.is_admin());
create policy "admins write" on public.admins for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "templates read"  on public.session_templates for select to authenticated using (true);
create policy "templates write" on public.session_templates for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "sessions read"  on public.sessions for select to authenticated using (true);
create policy "sessions write" on public.sessions for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "seats read"   on public.seats for select to authenticated using (true);
create policy "seats update" on public.seats for update to authenticated
  using (
    profile_id is null
    or profile_id = (auth.jwt() ->> 'sub')
    or public.is_admin()
  )
  with check (
    profile_id = (auth.jwt() ->> 'sub')
    or profile_id is null
    or public.is_admin()
  );

-- No Supabase Storage policies needed: profile photos come from the user's
-- Google account via Clerk (clerkUser.imageUrl), stored as a URL in
-- profiles.photo_url. We don't upload anything.

------------------------------------------------------------------------
-- ensure_sessions_materialized(weeks_ahead) — unchanged body, just recreated
------------------------------------------------------------------------
create or replace function public.ensure_sessions_materialized(weeks_ahead int default 14)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl record;
  week_offset int;
  base_date date;
  target_date date;
  start_ts timestamptz;
  end_ts timestamptz;
  zone constant text := 'America/New_York';
begin
  for tpl in
    select * from session_templates where active = true
  loop
    base_date := (now() at time zone zone)::date;
    target_date := base_date + ((tpl.day_of_week - extract(dow from base_date)::int + 7) % 7);

    for week_offset in 0..(weeks_ahead - 1) loop
      start_ts := ((target_date + week_offset * 7)::text || ' ' || tpl.start_time)::timestamp at time zone zone;
      end_ts   := ((target_date + week_offset * 7)::text || ' ' || tpl.end_time)::timestamp   at time zone zone;

      insert into sessions (template_id, type, starts_at, ends_at)
      select tpl.id, tpl.type, start_ts, end_ts
      where not exists (
        select 1 from sessions s
        where s.template_id = tpl.id and s.starts_at = start_ts
      );
    end loop;
  end loop;
end;
$$;

grant execute on function public.ensure_sessions_materialized(int) to anon, authenticated;

------------------------------------------------------------------------
-- claim_seat(seat_id) — caller identified by Clerk JWT sub claim (text)
------------------------------------------------------------------------
create or replace function public.claim_seat(p_seat_id uuid)
returns seats
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id text := (auth.jwt() ->> 'sub');
  target_session_id uuid;
  result_row seats;
begin
  if caller_id is null then
    raise exception 'Must be signed in to claim a seat';
  end if;

  select session_id into target_session_id
  from seats
  where id = p_seat_id and profile_id is null
  for update;

  if target_session_id is null then
    raise exception 'That seat is already taken';
  end if;

  update seats
  set profile_id = null, reserved_at = null
  where session_id = target_session_id
    and profile_id = caller_id;

  update seats
  set profile_id = caller_id, reserved_at = now()
  where id = p_seat_id
  returning * into result_row;

  return result_row;
end;
$$;

grant execute on function public.claim_seat(uuid) to authenticated;

------------------------------------------------------------------------
-- Realtime: re-add seats table to the realtime publication
-- (drop-table above removed it; alter publication is idempotent-friendly)
------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seats'
  ) then
    execute 'alter publication supabase_realtime add table public.seats';
  end if;
end $$;
