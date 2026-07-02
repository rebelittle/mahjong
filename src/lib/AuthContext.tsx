import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useUser, useClerk, useSignIn } from "@clerk/clerk-react";
import { supabase } from "./supabase";
import { upsertMyProfile } from "./dataApi";
import type { Profile } from "./database.types";

// Shape preserved (minus signInWithEmail) so downstream consumers
// (Header, LoginPage, MePage, SessionPage, HomePage) don't need to change.
// user/session are narrowed to just the fields the rest of the app actually
// reads (id, email).
interface AuthUser {
  id: string;
  email: string;
  imageUrl: string | null;
}
interface AuthSession {
  user: AuthUser;
}
interface AuthState {
  loading: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

interface ClerkApiError {
  errors?: Array<{ code?: string; message?: string }>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded: userLoaded, user: clerkUser } = useUser();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const clerk = useClerk();

  const [profile, setProfile] = useState<Profile | null>(null);

  const userId = clerkUser?.id ?? null;
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";

  // Name + photo come straight from the Google account (via Clerk) so the
  // user never has to type anything. Pull the primitives out here so the
  // provisioning effect below depends on stable strings, not the clerkUser
  // object identity (which changes every render).
  const clerkFullName = clerkUser?.fullName ?? "";
  const clerkFirstName = clerkUser?.firstName ?? "";
  const clerkLastName = clerkUser?.lastName ?? "";
  const clerkImageUrl = clerkUser?.imageUrl ?? null;

  const loadProfile = useCallback(async (id: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.error("Profile fetch error:", error.message);
        setProfile(null);
        return null;
      }
      const p = (data as Profile | null) ?? null;
      setProfile(p);
      return p;
    } catch (err) {
      console.error("Profile fetch threw:", err);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let alive = true;
    (async () => {
      const existing = await loadProfile(userId);
      if (!alive || existing) return;

      // First sign-in for this Clerk user: no profile row exists yet, which
      // would block seat claims (seats.profile_id has an FK to profiles).
      // Auto-create one from their Google account instead of making them
      // fill out a form.
      const fullName = clerkFullName.trim();
      const combinedName = [clerkFirstName, clerkLastName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");
      const displayName =
        fullName || combinedName || (email ? email.split("@")[0] : "Guest");

      try {
        await upsertMyProfile(userId, email, {
          display_name: displayName,
          photo_url: clerkImageUrl,
        });
        if (alive) await loadProfile(userId);
      } catch (err) {
        console.error("Auto-provision profile failed:", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, email, clerkFullName, clerkFirstName, clerkLastName, clerkImageUrl, loadProfile]);

  const loading = !userLoaded || !signInLoaded;

  const userView: AuthUser | null = clerkUser
    ? { id: clerkUser.id, email, imageUrl: clerkUser.imageUrl ?? null }
    : null;
  const session: AuthSession | null = userView ? { user: userView } : null;

  const value: AuthState = {
    loading,
    session,
    user: userView,
    profile,
    async signInWithGoogle() {
      if (!signIn) return { error: "Auth is still initializing — try again in a moment." };

      // Absolute URLs so Clerk hands them back through the OAuth dance
      // intact. Hash routes are preserved through Clerk's server-side
      // redirect — Clerk appends its callback params to the URL as a
      // query string after the hash path, which the SSO callback page
      // reads on mount.
      const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
      const redirectUrl = `${base}#/sso-callback`;
      const redirectUrlComplete = `${base}`;

      try {
        await signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl,
          redirectUrlComplete,
        });
        // The browser navigates away before this resolves; the return is
        // for type completeness only.
        return { error: null };
      } catch (err) {
        const clerkErr = err as ClerkApiError;
        return { error: clerkErr.errors?.[0]?.message ?? "Could not start Google sign-in." };
      }
    },
    async signOut() {
      await clerk.signOut();
    },
    async refreshProfile() {
      if (userId) await loadProfile(userId);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
