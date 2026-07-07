-- Migration 0014: Reassign the two July 2026 special ("Crack, Bam, Create!")
-- sessions. Run in Supabase SQL editor after 0013.
--
--   * Jul 17 stays a Crack, Bam, Create! event but now runs the
--     "Summer Style Studio: Hats & Bags" art project (was "Kinusaiga Art").
--   * Jul 10 is no longer a Crack, Bam, Create! event — it becomes a regular
--     Friday "Lesson for Beginners" (type 'beginner', 4:00–6:00 PM EDT) and its
--     custom art notes are cleared so it renders from the beginner template.
--
-- Both rows are updated in place, so the auto-generated seats (16 per session)
-- are reused and any existing bookings are preserved.
--   Jul 10  4:00 PM EDT = 20:00 UTC ; 6:00 PM EDT = 22:00 UTC
--   Jul 17  4:00 PM EDT = 20:00 UTC ; 8:00 PM EDT = 00:00 UTC (next day)

------------------------------------------------------------------------
-- 1. Jul 17: swap the art project to Summer Style Studio: Hats & Bags.
------------------------------------------------------------------------
update public.sessions
   set notes = 'Summer Style Studio: Hats & Bags — Choose a beach hat or tote and make it completely your own with paint, beads, charms, ribbons, and more!'
 where type = 'crack_bam_create'
   and starts_at = '2026-07-17T20:00:00Z';

------------------------------------------------------------------------
-- 2. Jul 10: convert the Crack, Bam, Create! slot into a standard
--    Friday Lesson for Beginners. Shorten to 2 hours (4–6 PM EDT) and
--    clear the custom art notes.
------------------------------------------------------------------------
update public.sessions
   set type    = 'beginner',
       ends_at = '2026-07-10T22:00:00Z',
       notes   = null
 where type = 'crack_bam_create'
   and starts_at = '2026-07-10T20:00:00Z';
