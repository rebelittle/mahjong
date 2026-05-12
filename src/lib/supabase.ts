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

// Use a syntactically-valid placeholder URL when env is missing so createClient
// doesn't throw at module load. The app gates real usage behind
// isSupabaseConfigured so this client never actually makes a network call.
export const supabase = createClient<Database>(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      // PKCE puts the auth code in ?code=… (search params), not in the URL
      // hash. Critical because we use HashRouter — implicit-flow tokens land
      // in the hash and collide with the router.
      flowType: "pkce",
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
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
