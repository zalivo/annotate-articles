export default function LibraryLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <nav
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--border)" }} />
        <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </nav>

      <main className="mx-auto px-6 py-16" style={{ maxWidth: "720px" }}>
        <header className="mb-12">
          <div className="h-10 w-40 rounded animate-pulse mb-3" style={{ background: "var(--border)" }} />
          <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--border)" }} />
        </header>

        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="py-6 flex flex-col gap-2">
              <div className="h-5 rounded animate-pulse" style={{ background: "var(--border)", width: `${60 + (i % 3) * 15}%` }} />
              <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--border)" }} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
