import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Top-level safety net: when a render throws, show the error instead of a
// silent blank page. Without this, an exception anywhere in the tree results
// in just an empty body.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-14 sm:px-6">
        <div className="card overflow-hidden p-7 sm:p-9">
          <p className="pill" style={{ color: "#B8302A" }}>Something went wrong</p>
          <h1 className="mt-3 text-3xl">Sorry — that page hit an error.</h1>
          <p className="mt-3 text-fox-ink/75">
            Try a hard refresh (Ctrl/Cmd + Shift + R). If it keeps happening, the message
            below is useful to share.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-fox-cream-200 bg-fox-cream-50 p-4 text-xs text-fox-ink/80">
{String(this.state.error?.message ?? this.state.error)}
          </pre>
          <a href={import.meta.env.BASE_URL} className="btn-primary mt-5 inline-block">
            Back to home
          </a>
        </div>
      </main>
    );
  }
}
