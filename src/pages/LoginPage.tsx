import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<"idle" | "redirecting" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function onGoogleClick() {
    if (loading) return;
    setStatus("redirecting");
    setErrMsg("");
    const { error } = await signInWithGoogle();
    if (error) {
      setStatus("error");
      setErrMsg(error);
    }
    // On success the browser is already redirecting to Google.
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-14 sm:px-6">
      <div className="card relative overflow-hidden p-7 sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rotate-12 rounded-3xl bg-fox-yellow-500/10 blur-2xl" />
        <p className="pill">Sign in</p>
        <h1 className="mt-3 text-3xl">Welcome.</h1>
        <p className="mt-2 text-fox-ink/75">
          One tap to sign in with your Google account — no passwords, no email back-and-forth.
        </p>

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={onGoogleClick}
            disabled={loading || status === "redirecting"}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-fox-cream-200 bg-white px-5 py-3 text-base font-semibold text-fox-navy-700 shadow-sm transition hover:-translate-y-0.5 hover:border-fox-yellow-500/60 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            <GoogleGlyph />
            {status === "redirecting" ? "Redirecting…" : "Continue with Google"}
          </button>
          {status === "error" && (
            <p className="text-sm text-tile-red">{errMsg || "Something went wrong, try again."}</p>
          )}
        </div>

        <p className="mt-6 text-xs text-fox-ink/55">
          By signing in you agree to be charmingly present at one of the three weekly
          Mah Jongg sessions at Fox Hill School.
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.8l6.3 5.3C41 36 44 30.4 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
