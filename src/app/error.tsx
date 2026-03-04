"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
      style={{ background: "var(--cream)" }}
    >
      <p
        className="text-lg"
        style={{ fontFamily: "var(--font-lora)", color: "var(--ink-muted)" }}
      >
        Something went wrong.
      </p>
      {error.message && (
        <p
          className="text-sm max-w-md text-center"
          style={{ fontFamily: "var(--font-geist-sans)", color: "var(--ink-faint)" }}
        >
          {error.message}
        </p>
      )}
      <div className="flex gap-4 mt-2">
        <button
          onClick={reset}
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
        >
          Try again
        </button>
        <a
          href="/"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
        >
          ← Home
        </a>
      </div>
    </div>
  );
}
