import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { initialsOf } from "../lib/utils";

export default function Header() {
  const { user, profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-fox-cream-200 bg-fox-cream-50/85 backdrop-blur supports-[backdrop-filter]:bg-fox-cream-50/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3 transition hover:opacity-80">
          <TileLogo />
          <div className="leading-tight">
            <div className="font-display text-xl text-fox-navy-700">Fox Hill Mah Jongg</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fox-yellow-700">
              Summer Sessions
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <NavLink to="/me" className={navClass} title="My reservations">
                My seats
              </NavLink>
              <NavLink to="/me" className="ml-1 flex items-center gap-2 rounded-full border border-fox-cream-200 bg-white px-2.5 py-1 pr-3 text-sm transition hover:border-fox-yellow-500/40 hover:bg-fox-cream-50">
                <Avatar profile={profile} />
                <span className="hidden max-w-[120px] truncate sm:inline">
                  {profile?.display_name ?? "My seats"}
                </span>
              </NavLink>
              <button
                onClick={() => signOut()}
                className="hidden text-xs font-medium text-fox-ink/60 underline-offset-2 transition hover:text-fox-navy-700 hover:underline sm:inline"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary text-sm">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "hidden rounded-full px-3 py-1.5 text-sm font-medium transition sm:inline",
    isActive ? "bg-fox-navy-700 text-fox-cream-50" : "text-fox-navy-700 hover:bg-fox-cream-100",
  ].join(" ");
}

function Avatar({ profile }: { profile: { display_name: string; photo_url: string | null } | null }) {
  if (profile?.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt=""
        className="h-7 w-7 rounded-full object-cover ring-1 ring-fox-yellow-500/60"
      />
    );
  }
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-fox-yellow-500/20 text-[11px] font-semibold uppercase text-fox-navy-700 ring-1 ring-fox-yellow-500/60">
      {profile ? initialsOf(profile.display_name) : "?"}
    </span>
  );
}

function TileLogo() {
  return (
    <svg width="34" height="48" viewBox="0 0 40 56" className="drop-shadow-sm" aria-hidden>
      <rect x="1" y="1" width="38" height="54" rx="6" ry="6" fill="#FBF3DA" stroke="#13294A" strokeWidth="1.5" />
      <text
        x="20"
        y="36"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="22"
        fontWeight="700"
        fill="#B8302A"
      >
        萬
      </text>
    </svg>
  );
}
