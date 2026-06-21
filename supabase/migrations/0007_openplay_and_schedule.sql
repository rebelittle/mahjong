-- Migration 0007: add "openplay" session type, fix template schedule,
--                 add start_from param to ensure_sessions_materialized.
-- Run in Supabase SQL editor after 0006.

------------------------------------------------------------------------
-- 1. Widen type check constraints to include "openplay"
------------------------------------------------------------------------
alter table public.session_templates
  drop constraint if exists session_templates_type_check;
alter table public.session_templates
  add constraint session_templates_type_check
  check (type in ('mommy', 'beginner', 'experienced', 'openplay'));

alter table public.sessions
  drop constraint if exists sessions_type_check;
alter table public.sessions
  add constraint sessions_type_check
  check (type in ('mommy', 'beginner', 'experienced', 'openplay'));

------------------------------------------------------------------------
-- 2. Fix template schedule
------------------------------------------------------------------------
-- "mommy"      → Lesson for Beginners: Tuesday (2) 18:00–20:00
update public.session_templates set day_of_week = 2, start_time = '18:00', end_time = '20:00' where type = 'mommy';
-- "experienced" → Mommy Mahj!:         Wednesday (3) 12:30–14:30
update public.session_templates set day_of_week = 3, start_time = '12:30', end_time = '14:30' where type = 'experienced';
-- "beginner"   → Lesson for Beginners: Friday (5) 16:00–18:00
update public.session_templates set day_of_week = 5, start_time = '16:00', end_time = '18:00' where type = 'beginner';

------------------------------------------------------------------------
-- 3. Add "openplay" template: Wednesday (3) 18:00–20:00
------------------------------------------------------------------------
insert into public.session_templates (type, day_of_week, start_time, end_time)
values ('openplay', 3, '18:00', '20:00')
on conflict do nothing;

------------------------------------------------------------------------
-- 4. Clear future sessions so they regenerate at the correct times
------------------------------------------------------------------------
delete from public.sessions where starts_at >= now();

------------------------------------------------------------------------
-- 5. Replace ensure_sessions_materialized with a start_from-aware version.
--    The new signature (weeks_ahead int, start_from date default null)
--    replaces the old (weeks_ahead int) function.
------------------------------------------------------------------------
drop function if exists public.ensure_sessions_materialized(int);

create or replace function public.ensure_sessions_materialized(
  weeks_ahead int default 14,
  start_from  date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl          record;
  week_offset  int;
  base_date    date;
  target_date  date;
  start_ts     timestamptz;
  end_ts       timestamptz;
  zone constant text := 'America/New_York';
begin
  -- Use start_from if provided; otherwise default to today in Eastern time.
  base_date := coalesce(start_from, (now() at time zone zone)::date);

  for tpl in
    select * from session_templates where active = true
  loop
    -- First occurrence of tpl.day_of_week on or after base_date
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

grant execute on function public.ensure_sessions_materialized(int, date) to anon, authenticated;
