export default function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-fox-yellow-500/30 border-t-fox-yellow-500" />
        <p className="text-sm text-fox-ink/60">{label}</p>
      </div>
    </main>
  );
}
