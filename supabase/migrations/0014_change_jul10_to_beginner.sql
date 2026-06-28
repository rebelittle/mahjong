-- Migration 0014: Change Jul 10 from Crack, Bam, Create! to a regular beginner lesson.
-- Run in Supabase SQL editor after 0013.

update public.sessions
  set
    type     = 'beginner',
    ends_at  = '2026-07-10T22:00:00Z',  -- 6:00 PM EDT (was 8:00 PM for 4-hr special)
    notes    = null
  where starts_at = '2026-07-10T20:00:00Z'
    and type      = 'crack_bam_create';
