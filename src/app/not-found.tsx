export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
      style={{ background: "var(--cream)" }}
    >
      <p
        className="text-7xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-lora)", color: "var(--ink-faint)" }}
      >
        404
      </p>
      <p
        className="text-lg"
        style={{ fontFamily: "var(--font-lora)", color: "var(--ink-muted)" }}
      >
        This page doesn&apos;t exist.
      </p>
      <a
        href="/"
        className="mt-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
        style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
      >
        ← Back to Highlight Stack
      </a>
    </div>
  );
}
