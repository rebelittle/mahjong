import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Locally: copy .env.local.example to .env.local. " +
      "On GitHub Pages: add both as repo secrets in Settings → Secrets and variables → Actions, then re-run the workflow.",
  );
}

// Clerk's ClerkJS attaches itself to window once <ClerkProvider> mounts.
// Supabase calls our accessToken() before every request; we return Clerk's
// short-lived JWT, which Supabase validates against the third-party-auth
// integration configured in the dashboard. Returning null at boot (before
// Clerk has mounted, or while signed out) is fine — RLS policies that
// require a sub claim will just refuse.
interface ClerkWindow {
  Clerk?: {
    session?: { getToken: () => Promise<string | null> };
  };
}
async function getClerkToken(): Promise<string | null> {
  const w = window as unknown as ClerkWindow;
  try {
    return (await w.Clerk?.session?.getToken()) ?? null;
  } catch (err) {
    console.warn("Clerk getToken failed:", err);
    return null;
  }
}

// Use a syntactically-valid placeholder URL when env is missing so createClient
// doesn't throw at module load. The app gates real usage behind
// isSupabaseConfigured so this client never actually makes a network call.
export const supabase = createClient<Database>(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    accessToken: getClerkToken,
  },
);

// Typed RPC helper. supabase-js v2.105's rpc() generic inference fights us
// (defaults Args to `never`); this wrapper threads the Database types
// through explicitly so callers get full type safety.
type Fns = Database["public"]["Functions"];
export async function rpc<N extends keyof Fns>(
  name: N,
  args: Fns[N]["Args"],
): Promise<Fns[N]["Returns"]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as Fns[N]["Returns"];
}
