"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { ShareButton } from "@/app/article/[id]/ShareButton";

interface Props {
  article: {
    id: string;
    title: string | null;
    siteName: string | null;
    author: string | null;
  };
  annotationCount: number;
}

export function LibraryArticleRow({ article, annotationCount }: Props) {
  const router = useRouter();
  const [deleteHovered, setDeleteHovered] = useState(false);

  const deleteAll = trpc.annotations.deleteAllByArticle.useMutation({
    onSuccess: () => router.refresh(),
  });

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Remove all your annotations on "${article.title}"?`)) return;
    deleteAll.mutate({ articleId: article.id });
  }

  return (
    <li className="flex items-center gap-3 py-5">
      <Link
        href={`/article/${article.id}`}
        className="flex flex-col gap-1 flex-1 min-w-0 group transition-opacity hover:opacity-70"
      >
        <h2
          className="text-lg leading-snug truncate"
          style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
        >
          {article.title}
        </h2>
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
        >
          {article.siteName && <span>{article.siteName}</span>}
          {article.siteName && <span>·</span>}
          {article.author && <span>{article.author}</span>}
          {article.author && <span>·</span>}
          <span>
            {annotationCount} annotation{annotationCount === 1 ? "" : "s"}
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        <ShareButton articleId={article.id} />
        <button
          onClick={handleDelete}
          disabled={deleteAll.isPending}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          style={{
            background: deleteHovered ? "#fef2f2" : "transparent",
            border: deleteHovered ? "1px solid #fca5a5" : "1px solid var(--border)",
            color: deleteHovered ? "#ef4444" : "var(--ink-muted)",
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          {deleteAll.isPending ? (
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
