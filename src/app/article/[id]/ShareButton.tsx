"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";

export function ShareButton({ articleId }: { articleId: string }) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const createLink = trpc.sharedLinks.create.useMutation({
    onSuccess: (link) => {
      const url = `${window.location.origin}/s/${link.id}`;
      setShareUrl(url);
      copyToClipboard(url);
    },
  });

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShare() {
    if (shareUrl) {
      copyToClipboard(shareUrl);
      return;
    }
    createLink.mutate({ articleId });
  }

  return (
    <button
      onClick={handleShare}
      disabled={createLink.isPending}
      className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
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
          {createLink.isPending ? "Sharing…" : "Share annotations"}
        </>
      )}
    </button>
  );
}
