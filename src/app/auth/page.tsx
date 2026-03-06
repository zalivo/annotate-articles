"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setError("");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--cream)" }}>
        <div className="text-center max-w-sm">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "var(--highlight)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4.5 4.5L16 6" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2
            className="text-2xl mb-3"
            style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
          >
            Check your email
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
          >
            We sent a magic link to <strong style={{ color: "var(--ink)" }}>{email}</strong>.
            Click it to sign in — no password needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>
      <nav
        className="flex items-center justify-between px-8 py-6 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Link
          href="/"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
        >
          Highlight Stack
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1
            className="text-4xl mb-2"
            style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
          >
            Sign in
          </h1>
          <p
            className="text-sm mb-8"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
          >
            Enter your email to receive a magic link.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div
              className="flex items-center gap-3 rounded-xl px-5 py-4 transition-shadow focus-within:shadow-lg"
              style={{
                background: "#fff",
                border: `1.5px solid ${status === "error" ? "#D94F3D" : "var(--border)"}`,
                boxShadow: "0 1px 4px rgba(28,23,16,0.06)",
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="you@example.com"
                required
                disabled={status === "loading"}
                className="flex-1 bg-transparent outline-none text-base disabled:opacity-50"
                style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
              />
            </div>

            {status === "error" && (
              <p className="text-sm px-1" style={{ color: "#D94F3D", fontFamily: "var(--font-geist-sans)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading" || !email.trim()}
              className="rounded-xl px-5 py-4 text-sm font-medium transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: "var(--ink)",
                color: "var(--cream)",
                fontFamily: "var(--font-geist-sans)",
              }}
            >
              {status === "loading" ? "Sending…" : "Send magic link →"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
