-- Migration 0005: drop from 5 tables per session to 4.
--
-- Wipes any existing sessions/seats and recreates the schema with the
-- new check constraint + 4-loop seat generator. Safe because no real
-- bookings exist yet. Run after 0003.

drop trigger if exists generate_seats_after_session_insert on public.sessions;
drop function if exists public.generate_seats_for_session() cascade;

delete from public.seats;
delete from public.sessions;

alter table public.seats drop constraint if exists seats_table_number_check;
alter table public.seats add constraint seats_table_number_check
  check (table_number between 1 and 4);

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
