"use client";

import { useState } from "react";

interface Annotation {
  highlightedText: string;
  comment: string | null;
  color: string;
}

interface Props {
  articleTitle: string;
  sourceUrl: string;
  annotations: Annotation[];
}

export function CopyHighlightsButton({ articleTitle, sourceUrl, annotations }: Props) {
  const [copied, setCopied] = useState(false);

  if (annotations.length === 0) return null;

  function handleCopy() {
    const lines = [`# ${articleTitle}`, `Source: ${sourceUrl}`, ""];

    for (const ann of annotations) {
      lines.push(`> ${ann.highlightedText}`);
      if (ann.comment) {
        lines.push("", ann.comment);
      }
      lines.push("");
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--ink)",
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6l2.5 2.5L9.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 4V2.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5H4" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Export as Markdown
        </>
      )}
    </button>
  );
}
