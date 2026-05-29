import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import SetupRequiredPage from "./pages/SetupRequiredPage";
import "./index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = Boolean(clerkPublishableKey);

// HashRouter avoids the GitHub Pages SPA 404 problem. URLs look like
// /mahjong/#/profile but everything just works without server-side rewrites.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      {isSupabaseConfigured && isClerkConfigured ? (
        <ClerkProvider publishableKey={clerkPublishableKey}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ClerkProvider>
      ) : (
        <SetupRequiredPage />
      )}
    </HashRouter>
  </React.StrictMode>,
);
