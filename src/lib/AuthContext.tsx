import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useUser, useClerk, useSignIn } from "@clerk/clerk-react";
import { supabase } from "./supabase";
import type { Profile } from "./database.types";

// Shape preserved (minus signInWithEmail) so downstream consumers
// (Header, LoginPage, ProfilePage, MePage, SessionPage, HomePage) don't
// need to change. user/session are narrowed to just the fields the rest
// of the app actually reads (id, email).
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

  const loadProfile = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.error("Profile fetch error:", error.message);
        setProfile(null);
        return;
      }
      setProfile((data as Profile | null) ?? null);
    } catch (err) {
      console.error("Profile fetch threw:", err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

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
