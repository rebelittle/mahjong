import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ProfilePage from "./pages/ProfilePage";
import SessionPage from "./pages/SessionPage";
import MePage from "./pages/MePage";
import { useAuth } from "./lib/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Spinner from "./components/Spinner";

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/me" element={<RequireAuth><MePage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  // Show a visible spinner instead of `null` — easier to diagnose if auth
  // initialization hangs.
  if (loading) return <Spinner label="Signing you in…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
