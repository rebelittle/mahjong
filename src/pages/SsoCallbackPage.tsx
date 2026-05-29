import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

// Clerk redirects here after Google authorizes. The callback component
// reads the OAuth state from the URL, completes the sign-in (or sign-up),
// then navigates to the URL passed as redirectUrlComplete from
// signIn.authenticateWithRedirect (the root, in our case).
//
// The visible UI is just a spinner — most users never even see it because
// the verification finishes in a few hundred ms.
export default function SsoCallbackPage() {
  // Explicit fallback URLs are required on GitHub Pages — the app lives at
  // `/mahjong/`, not the origin root. Without these, Clerk falls back to
  // navigating to `/` (the portfolio site) when redirectUrlComplete
  // can't be honored.
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={base}
        signUpFallbackRedirectUrl={base}
        signInForceRedirectUrl={base}
        signUpForceRedirectUrl={base}
      />
      <main className="grid min-h-[60vh] place-items-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-fox-yellow-500/30 border-t-fox-yellow-500" />
          <p className="text-sm text-fox-ink/60">Finishing sign-in…</p>
        </div>
      </main>
    </>
  );
}
