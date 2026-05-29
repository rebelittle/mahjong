import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The base path is the repo slug for GitHub Pages project sites.
// Override with VITE_BASE at build time (e.g. `VITE_BASE=/ npm run build`)
// if you ever deploy to a root path or custom domain.
const base = process.env.VITE_BASE ?? "/mahjong/";

export default defineConfig({
  plugins: [react()],
  base,
});
