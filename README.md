# Fox Hill Mahjong

Weekly summer Mahjong sign-up app for Fox Hill School. Static frontend on GitHub Pages, Supabase backend.

See [`PLAN.md`](./PLAN.md) for the overall architecture and decisions.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase keys
npm run dev
```

The dev server runs at `http://localhost:5173/mahjong/` (the `/mahjong/` base path matches the GitHub Pages deployment).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to GitHub Pages.

One-time setup, in order:
1. Create a GitHub repo named `mahjong` (or update `base` in `vite.config.ts` if you use a different name).
2. In **Settings → Pages**, set Source to "GitHub Actions".
3. In **Settings → Secrets and variables → Actions**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. `git push origin main` — the workflow does the rest. Live URL appears on the Pages settings page.

## Backend setup

See [`SETUP.md`](./SETUP.md) for Supabase project creation and the SQL migration.

## Project layout

```
src/
  components/    React components (Header, SessionCard, …)
  data/          Static config (session templates, etc.)
  App.tsx        Page composition
  main.tsx       React entry point
  index.css      Tailwind base + theme component classes
public/
  tile-pattern.svg   Background tile pattern
  favicon.svg
supabase/
  migrations/    SQL migrations to apply in the Supabase dashboard
.github/
  workflows/     CI/CD (GitHub Pages deploy)
PLAN.md          Project plan and decisions
SETUP.md         Step-by-step backend setup
```
