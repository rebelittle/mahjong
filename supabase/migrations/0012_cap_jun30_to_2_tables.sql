-- Migration 0012: Cap the Jun 30 Lesson for Beginners to 2 tables.
-- 8 seats are taken (tables 1 & 2 full), which unlocked table 3 (red).
-- Teacher wants to close it. Deleting table 3 seats for this session
-- hides the table in the UI and marks the session as full (8/8).

delete from public.seats
where table_number = 3
  and session_id = (
    select id from public.sessions
    where type = 'mommy'
      and starts_at >= '2026-06-30T00:00:00Z'
      and starts_at <  '2026-07-01T00:00:00Z'
    limit 1
  );
