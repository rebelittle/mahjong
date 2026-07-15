# Setup Guide

The frontend scaffold is ready. To get a working app you need to (1) create the GitHub repo and enable Pages, and (2) create a Supabase project and apply the migration. Both are one-time, free, and take ~10 minutes total.

---

## 1. Local sanity check

```bash
npm install
npm run dev
```

Visit `http://localhost:5173/mahjong/`. You should see the Fox Hill Mahjong landing page with the three session cards. The "Pick a seat" buttons are disabled — that's expected until the backend is wired up.

---

## 2. GitHub repo + Pages

1. Create a new GitHub repo named **`mahjong`** (private or public — your call).
   - If you pick a different name, update `base` in `vite.config.ts` to match (`/<repo-name>/`).
2. From the project directory:
   ```bash
   git init
   git add .
   git commit -m "Initial scaffold"
   git branch -M main
   git remote add origin https://github.com/<your-username>/mahjong.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The first push triggered the deploy workflow. Check the **Actions** tab — when the green check appears, your site is live at:
   `https://<your-username>.github.io/mahjong/`

At this point the build will succeed without Supabase secrets, but the app won't be able to talk to a backend until step 3 below.

---

## 3. Supabase project

1. Go to <https://supabase.com>, sign in, and create a new project. The free tier is fine.
   - **Project name:** Fox Hill Mahjong (anything works).
   - **Database password:** save it somewhere safe — you won't need it day-to-day, but you'll want it for recovery.
   - **Region:** pick the closest one.
2. Wait ~2 minutes for the project to provision.
3. In the Supabase dashboard, go to **SQL Editor → New query**, paste the contents of `supabase/migrations/0001_init.sql`, and run it. This:
   - Creates `profiles`, `admins`, `session_templates`, `sessions`, `seats` tables.
   - Sets up Row-Level Security policies.
   - Seeds `reaganlittle05@gmail.com` as the admin.
   - Seeds the three default weekly session templates.
4. Go to **Authentication → Providers** and confirm **Email** is enabled with **"Confirm email"** turned on (this enables magic-link sign-in).
5. Go to **Project Settings → API** and copy:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **anon / public key** → this is your `VITE_SUPABASE_ANON_KEY`

---

## 4. Wire the keys into the app

**Locally:**
```bash
cp .env.local.example .env.local
# edit .env.local and paste the two values from step 3.5
npm run dev
```

**For the deployed site:** In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add the same two values:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Push any commit (or re-run the latest workflow) and the deployed site will pick them up.

---

## 5. Verify

After step 4, the deployed site should still show the same landing page (auth and seat-booking UI is still under construction). Next development steps:

- Magic-link sign-in flow
- Profile creation with photo upload
- Session list backed by real `sessions` rows
- The visual table-layout view (the centerpiece)

See `PLAN.md § 13 Build Order` for the full sequence.

---

## 6. Automated roster emails

`.github/workflows/session-email.yml` runs hourly and emails the instructor
(`mlittle@foxhill-school.com`) the full signup list ~6 hours before each
session (first eligible session: Tuesday July 14, 2026). One-time setup:

1. Run `supabase/migrations/0015_session_email_log.sql` in the Supabase SQL editor.
2. Create a Gmail **app password**: <https://myaccount.google.com/apppasswords>
   (requires 2-Step Verification on the Google account that will send the emails).
3. Add three more repo secrets under **Settings → Secrets and variables → Actions**:
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API → `service_role` key
   - `GMAIL_USER` — the Gmail address that sends the emails
   - `GMAIL_APP_PASSWORD` — the app password from step 2
4. Test it: **Actions → Session roster email → Run workflow** with *test mode*
   checked and your own email as the recipient override. You should receive the
   roster for the next upcoming session within a minute.

To change the recipient, edit the `RECIPIENT` default in
`scripts/send-roster-email.mjs`.

---

## 7. Automated signup confirmation emails

`.github/workflows/signup-confirmation-email.yml` runs every 15 minutes and
emails each guest directly after they sign up for a session ("Thanks for
signing up, see you on [date]!"). It reuses the same secrets as the roster
email (section 6), so the only extra setup is:

1. Run `supabase/migrations/0016_signup_email_log.sql` in the Supabase SQL
   editor. This creates the sent-log table and backfills it with existing
   signups, so nobody who signed up before this feature gets a retroactive
   email.
2. Test it: sign up for an upcoming session, then **Actions → Signup
   confirmation email → Run workflow** with *test mode* checked. The
   confirmation for the most recent signup is sent to the `GMAIL_USER`
   inbox (or the recipient override, if given) without being logged as sent.

Guests receive at most one confirmation per session — switching seats within
the same session doesn't trigger a second email.

---

## Common issues

- **`npm run dev` shows a blank page at `/` but works at `/mahjong/`** — that's the GitHub Pages base path. The `/mahjong/` URL is correct.
- **GitHub Actions deploy fails on first run** — check that **Settings → Pages → Source** is set to "GitHub Actions", not "Deploy from a branch".
- **Magic link emails go to spam** — that's a Supabase free-tier characteristic. For production you'd configure a custom SMTP provider, but for a small community it's fine to tell people to check spam the first time.
