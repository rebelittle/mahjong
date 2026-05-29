# Fox Hill School Mahjong — Project Plan

A small web app to manage weekly summer Mahjong sessions at **Fox Hill School**. Players create a profile, browse the 3 weekly sessions, and pick a seat at one of 5 themed tables. Their profile picture appears on the chair they reserved so everyone can see who's joining them.

**Working title:** *Fox Hill Mahjong* (final name TBD — change in one config file).

---

## 0. Decisions Locked In

| Decision | Choice |
|---|---|
| Hosting | GitHub Pages (static) |
| Frontend | Vite + React + TypeScript + Tailwind |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Auth | Magic-link email |
| Schedule | Recurring weekly template, materialized ~8 weeks ahead |
| Season | Memorial Day → Labor Day (≈14 weeks) |
| Capacity | All sessions: 5 tables × 4 seats = 20 |
| Profile fields | Name, photo, skill level, free-text notes |
| Admin model | Single admin, email hardcoded in `admins` table |
| Admin email (seed) | `reaganlittle05@gmail.com` |
| Cancellation | No self-cancel — players message admin |
| Session times | Tue 10a Mommy / Wed 1p Beginner / Thu 10a Experienced (seeded, admin can edit) |
| Domain | None — use default `[username].github.io/mahjong/` |
| Visual theme | Real mahjong tile imagery in the background; color palette references foxhill-school.com (warm yellow/gold primary, navy accents, cream/white backgrounds, dark charcoal text) |

---

## 1. Goals & Scope

**Primary user (player):** A mom (or other adult) in the preschool community who wants to sign up for one of the three weekly Mahjong sessions and see who else is at her table.

**Primary admin:** Your mom — she runs the sessions and needs to see who's signed up, manage the schedule, and probably handle the occasional cancellation.

**Non-goals (for v1):**
- Payments / paid registration
- Mahjong gameplay itself (this is bookings only)
- Push notifications, email reminders (nice-to-have, not v1)
- Mobile native app (it just needs to work well in a mobile browser)

---

## 2. The Three Session Types

| Session | Audience | Notes |
|---|---|---|
| **Mommy Mahjong** | Moms playing while kids play outside / upstairs | Childcare provided. Possibly different capacity if kid count matters. |
| **Experienced Players** | Players already comfortable with the game | Pure play. |
| **Beginners** | New players | Starts with a teaching segment, then play. |

All three sessions have ≥1 advanced player floating around to help.

**Open question:** Are these three the same every week for the whole summer, or does the schedule vary? (See questions below.)

---

## 3. Core User Flows

### 3a. First-time player
1. Lands on home page → sees the upcoming week's three sessions.
2. Clicks "Sign up" on a session → prompted to create a profile (name, photo, optional skill level, optional notes like "allergic to peanuts" or "I bring my own set").
3. Lands on the **table layout view** for that session.
4. Picks an empty chair at one of the 5 tables → confirms → her photo appears on that chair.

### 3b. Returning player
1. Lands on home, signed in (magic link / saved login).
2. Picks a future session → goes straight to the table view → picks a seat.
3. Can view her upcoming reservations, cancel, or swap seats.

### 3c. Admin (your mom)
1. Sees all signups across all upcoming sessions.
2. Can manually add/remove a player from a seat (e.g. for someone who calls her).
3. Can create / cancel / reschedule sessions.
4. Can mark a player as an "advanced helper" so their chair shows a special badge.

---

## 4. Visual Concept — The Table Layout

The signature view of the app. It should feel **fun and themed**, not like a generic seat-picker.

**Layout idea:**
- Top-down view of a room with 5 tables arranged in a grid (2 + 2 + 1, or a horseshoe).
- Each table is square with 4 chairs (N, S, E, W) — matching real Mahjong table geometry.
- Empty chairs show a "+" or a tile icon prompting "Sit here."
- Taken chairs show a circular profile picture; tap/hover to see the player's name and notes.
- "Your seat" is highlighted with a glow or animated border.
- Themed details: a real mahjong tile pattern on the tables and as a subtle page background; the 4 winds (東南西北) marking each seat position; warm yellow/gold from Fox Hill's brand as the primary accent, navy for headings, cream/white for backgrounds — preschool-friendly, not overly serious.

**Responsive:**
- Desktop / tablet: full 5-table grid visible.
- Phone: tables stack vertically; can swipe between tables, or shrink the grid so all 5 fit at once with smaller chairs.

---

## 5. Tech Stack (locked in)

### Frontend — hosted on GitHub Pages (free)
- **Vite + React + TypeScript** — the table layout has enough interactive state that React earns its keep. Output is plain static files.
- **Tailwind CSS** for styling.
- **GitHub Actions** builds and deploys on every push to `main`.

### Backend — Supabase (free tier)
- Postgres database, Auth, file Storage, Realtime — all in one project, no server to run.
- Free tier (500 MB DB, 1 GB storage, 50k MAU) is far more than this app needs.
- Frontend talks to Supabase directly using the anon key (this is normal — security comes from Row-Level Security policies on the tables).

### Auth — Magic link email
- Player types email → gets a one-time link → clicks it → logged in. No passwords.
- Email becomes the durable identity, so re-signing in on a new phone Just Works.

### Schedule — Recurring weekly template
- Admin defines the three weekly slots once (e.g. "Mommy Mahjong, Tue 10am–12pm").
- A scheduled job (Supabase cron or just generate-on-read) materializes the next ~8 weeks of session rows from the template.
- Admin can cancel or edit a specific week without affecting the recurrence.

### Capacity — Uniform 5×4
- Every session: 5 tables, up to 4 seats each (20 total).
- A table with only 3 occupants on game day just plays 3-handed — that's a real-world tweak, not an app concern.

---

## 6. Data Model (Supabase / Postgres)

```
profiles
  id              uuid (= auth user id)
  email           text         -- from auth, denormalized for admin search
  display_name    text
  photo_url       text         -- Supabase Storage public URL
  skill_level     text         -- 'beginner' | 'intermediate' | 'advanced'
  notes           text         -- "I bring my own set", "allergic to peanuts", etc.
  is_helper       boolean      -- shows a badge; marks floating advanced players
  created_at      timestamptz

session_templates                -- the recurring weekly schedule
  id              uuid
  type            text         -- 'mommy' | 'experienced' | 'beginner'
  day_of_week     int          -- 0=Sun..6=Sat
  start_time      time
  end_time        time
  active          boolean

sessions                         -- materialized concrete weeks
  id              uuid
  template_id     uuid -> session_templates.id  (nullable for one-offs)
  type            text
  starts_at       timestamptz
  ends_at         timestamptz
  status          text         -- 'open' | 'cancelled'
  notes           text

seats
  id              uuid
  session_id      uuid -> sessions.id
  table_number    int          -- 1..5
  seat_position   text         -- 'east'|'south'|'west'|'north'
  profile_id      uuid -> profiles.id  (nullable = empty)
  reserved_at     timestamptz
  UNIQUE (session_id, table_number, seat_position)
  UNIQUE (session_id, profile_id)   -- one seat per person per session

admins
  email           text PRIMARY KEY   -- seeded with mom's email
```

**Row-Level Security highlights:**
- Anyone signed in can read profiles, sessions, seats.
- A profile row is only writable by its owner.
- A seat is only claimable when `profile_id IS NULL`; only the occupant (or admin) can clear it.
- `admins` table gate via `auth.email() IN (SELECT email FROM admins)` for admin-only mutations.

---

## 7. Page Structure

| Route | Purpose |
|---|---|
| `/` | Landing + the week's three sessions as cards, with "X / 20 seats taken" |
| `/login` | Magic link sign-in |
| `/profile` | Create / edit profile + photo |
| `/session/:id` | The table layout view — the main attraction |
| `/me` | "My reservations" + cancel buttons |
| `/admin` | Admin-only: roster across all sessions, manual edits, create sessions |

---

## 8. Concurrency / Race Conditions

Two players clicking the same chair at the same time is the one technical risk worth flagging:
- Supabase: `seats` row has a `UNIQUE(session_id, table_number, seat_position)` constraint and the claim is done as an `UPDATE seats SET profile_id = me WHERE id = X AND profile_id IS NULL` — the second click fails harmlessly and the UI refreshes.
- Realtime channel subscribed to the session's seats → other people's clicks animate in immediately.

---

## 9. Deployment

- **Repo:** GitHub repo, `main` branch is live.
- **Build & deploy:** GitHub Actions runs `npm run build` and publishes `dist/` to the `gh-pages` branch (or uses the native Pages action).
- **Custom domain (optional):** something like `mahjong.[preschoolname].com` if your mom wants — otherwise `[username].github.io/mahjong-sessions` is fine.
- **Supabase:** free project, anon key shipped to the frontend (this is normal and safe — RLS does the security).

---

## 10. Rough Build Order

1. Set up Vite + React + Tailwind, deploy a "hello world" to GitHub Pages → confirms hosting works.
2. Set up Supabase project, schema, RLS policies.
3. Profile creation (with photo upload to Supabase Storage).
4. Magic-link auth flow.
5. Sessions list on the home page (admin-seeded by hand for now).
6. The table layout view — read-only first, then claim-a-seat.
7. "My reservations" + cancel.
8. Admin view.
9. Polish: animations, mobile layout, empty states, error toasts.

Estimated effort: a focused weekend gets you to step 6 (a usable demo); another week of evenings to finish.

---

## 11. Risks & Things to Watch

- **Photo uploads on older phones** can be huge (10+ MB). Need client-side resize before upload.
- **Time zones** — store everything UTC, render in the preschool's local zone. Don't trust device clocks for "is this session in the future?"
- **Trolling / inappropriate photos.** Small community probably fine, but admin needs a "remove this photo" button.
- **A player without a smartphone** — admin needs to be able to book a seat *on behalf of* someone (or that person gets seated manually day-of).

---

## 12. Still-Open Items (not blocking code start)

These can be filled in as we go — none block the initial scaffold:

1. **Exact session day/times** — the seed defaults are placeholders; replace before launch.
2. **Final app name** — "Fox Hill Mahjong" is the working title.
3. **Custom domain** — `mahjong.foxhillschool.org`? Or stick with `[github-username].github.io/mahjong/`?
4. **Visual theme details** — mahjong tiles + the four winds is the directional idea; we'll iterate on the actual look once the table grid component exists.
5. **Childcare-side details for Mommy Mahjong** — does the app need to track which kids are upstairs? (Assumption for now: no, that's separate.)
6. **Photo moderation** — admin needs a "remove this photo" button. v1 nice-to-have.

## 13. Build Order (revised)

1. Repo init: Vite + React + TS + Tailwind. Deploy "hello world" to GitHub Pages.
2. Supabase project: schema, RLS policies, seed `admins` row, seed `session_templates`.
3. Magic-link auth + profile creation (name, photo upload with client-side resize, skill level, notes).
4. Home page: lists upcoming sessions for the current and next 1–2 weeks.
5. **Table layout view** — the centerpiece. Read-only first, then claim-a-seat with the atomic `UPDATE … WHERE profile_id IS NULL` pattern + realtime subscription.
6. "My reservations" page (read-only — no self-cancel per decision).
7. Admin view: cross-session roster, cancel sessions, edit templates, remove a player from a seat, toggle `is_helper`.
8. Polish: animations on seat claim, mobile layout pass, empty states, error toasts, photo moderation button.
