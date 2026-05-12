import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import SetupRequiredPage from "./pages/SetupRequiredPage";
import "./index.css";

// HashRouter avoids the GitHub Pages SPA 404 problem. URLs look like
// /majong/#/profile but everything just works without server-side rewrites.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      {isSupabaseConfigured ? (
        <AuthProvider>
          <App />
        </AuthProvider>
      ) : (
        <SetupRequiredPage />
      )}
    </HashRouter>
  </React.StrictMode>,
);
