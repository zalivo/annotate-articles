"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";

interface Props {
  stack: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    visibility: string;
    createdAt: Date;
    articleCount: number;
  };
}

export function StackCard({ stack }: Props) {
  const router = useRouter();
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const deleteStack = trpc.stacks.delete.useMutation({
    onSuccess: () => router.refresh(),
  });

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete stack "${stack.title}"?`)) return;
    deleteStack.mutate({ id: stack.id });
  }

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/stack/${stack.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <li className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-3">
      <Link
        href={`/stack/${stack.slug}`}
        className="flex flex-col gap-1 flex-1 min-w-0 group transition-opacity hover:opacity-70"
      >
        <div className="flex items-center gap-2">
          <h2
            className="text-lg leading-snug"
            style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
          >
            {stack.title}
          </h2>
          {stack.visibility === "public" ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(93, 201, 87, 0.15)",
                color: "#3a9e30",
                fontFamily: "var(--font-geist-sans)",
              }}
            >
              public
            </span>
          ) : (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(0,0,0,0.05)",
                color: "var(--ink-faint)",
                fontFamily: "var(--font-geist-sans)",
              }}
            >
              private
            </span>
          )}
        </div>
        {stack.description && (
          <p
            className="text-sm line-clamp-1"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
          >
            {stack.description}
          </p>
        )}
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
        >
          <span>
            {stack.articleCount} article{stack.articleCount === 1 ? "" : "s"}
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleShare}
          className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
          style={{
            background: copied ? "var(--highlight)" : "var(--ink)",
            color: copied ? "var(--ink)" : "var(--cream)",
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 7.5a2.5 2.5 0 0 0 3.5 0l1.5-1.5a2.5 2.5 0 0 0-3.5-3.5l-.75.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M7.5 4.5a2.5 2.5 0 0 0-3.5 0L2.5 6A2.5 2.5 0 0 0 6 9.5l.75-.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Share
            </>
          )}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteStack.isPending}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 cursor-pointer"
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          style={{
            background: deleteHovered ? "#fef2f2" : "transparent",
            border: deleteHovered ? "1px solid #fca5a5" : "1px solid var(--border)",
            color: deleteHovered ? "#ef4444" : "var(--ink-muted)",
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          {deleteStack.isPending ? (
            "Deleting…"
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 3h8M5 3V2h2v1M5 5v4M7 5v4M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Delete
            </>
          )}
        </button>
      </div>
    </li>
  );
}
