"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function Home() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
    const [error, setError] = useState("");
    const [isSignedIn, setIsSignedIn] = useState(false);
    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        supabase.auth.getSession().then(({ data }) => {
            setIsSignedIn(!!data.session);
        });
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = url.trim();
        if (!trimmed) return;

        setStatus("loading");
        setError("");

        try {
            const res = await fetch("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: trimmed }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Something went wrong.");
                setStatus("error");
                return;
            }

            router.push(`/article/${data.id}`);
        } catch {
            setError("Network error — check your connection.");
            setStatus("error");
        }
    }

    const isLoading = status === "loading";

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: "var(--cream)" }}
        >
            {/* Nav */}
            <nav
                className="flex items-center justify-between px-8 py-4 border-b"
                style={{ borderColor: "var(--border)" }}
            >
                <Link
                    href="/"
                    className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
                    style={{
                        color: "var(--ink-muted)",
                        fontFamily: "var(--font-geist-sans)",
                    }}
                >
                    Highlight Stack
                </Link>
                {isSignedIn ? (
                    <Link
                        href="/library"
                        className="text-sm transition-opacity hover:opacity-60"
                        style={{
                            color: "var(--ink-muted)",
                            fontFamily: "var(--font-geist-sans)",
                        }}
                    >
                        My Library
                    </Link>
                ) : (
                    <Link
                        href="/auth"
                        className="text-sm transition-opacity hover:opacity-60"
                        style={{
                            color: "var(--ink-muted)",
                            fontFamily: "var(--font-geist-sans)",
                        }}
                    >
                        Sign in
                    </Link>
                )}
            </nav>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
                <div className="w-full max-w-2xl flex flex-col items-center gap-12">
                    {/* Wordmark */}
                    <div className="text-center">
                        <h1
                            className="text-6xl sm:text-7xl leading-tight"
                            style={{
                                fontFamily: "var(--font-lora)",
                                color: "var(--ink)",
                            }}
                        >
                            HIGH
                            <span
                                className="italic"
                                style={{
                                    background: "var(--highlight)",
                                    padding: "0 6px 2px",
                                }}
                            >
                                LIGHT
                            </span>
                            {" "}STACK
                        </h1>

                        <p
                            className="mt-6 text-lg leading-relaxed"
                            style={{
                                color: "var(--ink-muted)",
                                fontFamily: "var(--font-geist-sans)",
                                maxWidth: "36ch",
                                margin: "1.5rem auto 0",
                            }}
                        >
                            Paste an article URL. Highlight what matters. Share
                            your throughts with your friends.
                        </p>
                    </div>

                    {/* Input */}
                    <form
                        onSubmit={handleSubmit}
                        className="w-full flex flex-col gap-3"
                    >
                        <div
                            className="flex items-center gap-3 rounded-xl px-5 py-4 transition-shadow focus-within:shadow-lg"
                            style={{
                                background: "#fff",
                                border: `1.5px solid ${status === "error" ? "#D94F3D" : "var(--border)"}`,
                                boxShadow: "0 1px 4px rgba(28,23,16,0.06)",
                            }}
                        >
                            {/* Link icon */}
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                style={{
                                    flexShrink: 0,
                                    color: "var(--ink-faint)",
                                }}
                            >
                                <path
                                    d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg>

                            <input
                                type="url"
                                value={url}
                                onChange={(e) => {
                                    setUrl(e.target.value);
                                    if (status === "error") setStatus("idle");
                                }}
                                placeholder="Paste an article URL…"
                                disabled={isLoading}
                                className="flex-1 bg-transparent outline-none text-base disabled:opacity-50"
                                style={{
                                    color: "var(--ink)",
                                    fontFamily: "var(--font-geist-sans)",
                                }}
                            />

                            <button
                                type="submit"
                                disabled={isLoading || !url.trim()}
                                className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                style={{
                                    background: "var(--ink)",
                                    color: "var(--cream)",
                                    fontFamily: "var(--font-geist-sans)",
                                }}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <Spinner />
                                        Fetching…
                                    </span>
                                ) : (
                                    "Open →"
                                )}
                            </button>
                        </div>

                        {status === "error" && (
                            <p
                                className="text-sm px-1"
                                style={{
                                    color: "#D94F3D",
                                    fontFamily: "var(--font-geist-sans)",
                                }}
                            >
                                {error}
                            </p>
                        )}
                    </form>
                </div>
            </main>

            {/* Footer */}
            <footer
                className="border-t px-8 py-5 flex items-center justify-center"
                style={{ borderColor: "var(--border)" }}
            >
                <p
                    className="text-xs"
                    style={{
                        color: "var(--ink-faint)",
                        fontFamily: "var(--font-geist-sans)",
                    }}
                >
                    Always links to the original — never reproduces content as
                    your own.
                </p>
            </footer>
        </div>
    );
}

function Spinner() {
    return (
        <svg
            className="animate-spin"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
        >
            <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeOpacity="0.3"
            />
            <path
                d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
