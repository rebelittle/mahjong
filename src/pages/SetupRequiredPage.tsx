// Rendered when required env vars are missing (Clerk publishable key, or
// Supabase URL/anon key). Better than a blank page: tells the deployer
// exactly what to fix.
export default function SetupRequiredPage() {
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <svg width="32" height="44" viewBox="0 0 40 56" aria-hidden>
          <rect x="1" y="1" width="38" height="54" rx="6" fill="#FBF3DA" stroke="#13294A" strokeWidth="1.5" />
          <text x="20" y="36" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill="#B8302A">萬</text>
        </svg>
        <div className="font-display text-xl text-fox-navy-700">Fox Hill Mahjong</div>
      </div>
      <div className="card overflow-hidden p-7 sm:p-9">
        <p className="pill" style={{ color: "#B8302A" }}>Setup needed</p>
        <h1 className="mt-3 text-3xl">Fox Hill Mahjong isn't connected to its auth + database yet.</h1>
        <p className="mt-3 text-fox-ink/75">
          The frontend is up, but Clerk and/or Supabase credentials haven't been wired in.
          Once these are set the app will load normally.
        </p>

        <h2 className="mt-7 text-lg">Required environment variables:</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-fox-ink/80">
          <li><code>VITE_CLERK_PUBLISHABLE_KEY</code> — from Clerk dashboard → API keys</li>
          <li><code>VITE_SUPABASE_URL</code> — from Supabase → Project Settings → API</li>
          <li><code>VITE_SUPABASE_ANON_KEY</code> — same place</li>
        </ul>

        <h2 className="mt-7 text-lg">Set them in:</h2>

        {isLocal ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-fox-ink/80">
            <li>
              Copy <code className="rounded bg-fox-cream-100 px-1.5 py-0.5 text-sm">.env.local.example</code>
              {" "}to <code className="rounded bg-fox-cream-100 px-1.5 py-0.5 text-sm">.env.local</code>.
            </li>
            <li>Fill in the three values above.</li>
            <li>Restart <code className="text-sm">npm run dev</code>.</li>
          </ol>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-fox-ink/80">
            <li>
              GitHub repo → <strong>Settings → Secrets and variables → Actions</strong>.
            </li>
            <li>Add all three as repository secrets.</li>
            <li>
              <strong>Actions</strong> tab → latest run → <em>Re-run all jobs</em>.
            </li>
          </ol>
        )}

        <p className="mt-7 text-xs text-fox-ink/55">
          Also required: in Supabase dashboard → Auth → Sign In/Up → Third Party Auth,
          add Clerk as a provider using the issuer URL from Clerk's Supabase integration.
        </p>
      </div>
    </main>
  );
}
