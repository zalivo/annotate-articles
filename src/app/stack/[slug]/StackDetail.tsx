"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/trpc/client";

interface StackArticle {
  articleId: string;
  position: number;
  title: string;
  author: string | null;
  siteName: string | null;
  sourceUrl: string;
  annotationCount: number;
}

interface Props {
  stack: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    visibility: string;
    creatorId: string;
    createdAt: Date;
  };
  creator: { id: string; name: string } | undefined;
  articles: StackArticle[];
  isOwner: boolean;
  libraryArticles: { id: string; title: string; siteName: string | null }[];
}

export function StackDetail({ stack, creator, articles: initialArticles, isOwner, libraryArticles }: Props) {
  const router = useRouter();
  const [articles, setArticles] = useState(initialArticles);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(stack.title);
  const [description, setDescription] = useState(stack.description ?? "");
  const [visibility, setVisibility] = useState(stack.visibility);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const updateStack = trpc.stacks.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
  });

  const addArticle = trpc.stacks.addArticle.useMutation({
    onSuccess: () => router.refresh(),
  });

  const removeArticle = trpc.stacks.removeArticle.useMutation({
    onSuccess: (_, vars) => {
      setArticles((prev) => prev.filter((a) => a.articleId !== vars.articleId));
    },
  });

  const reorder = trpc.stacks.reorderArticles.useMutation();

  function handleSaveEdit() {
    updateStack.mutate({
      id: stack.id,
      title: title.trim(),
      description: description.trim() || undefined,
      visibility: visibility as "private" | "public",
    });
  }

  function handleAddArticle(articleId: string) {
    addArticle.mutate({ stackId: stack.id, articleId });
    setShowPicker(false);
    setPickerSearch("");
  }

  function handleRemoveArticle(articleId: string) {
    removeArticle.mutate({ stackId: stack.id, articleId });
  }

  function handleMove(index: number, direction: "up" | "down") {
    const newArticles = [...articles];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newArticles.length) return;
    [newArticles[index], newArticles[swapIndex]] = [newArticles[swapIndex], newArticles[index]];
    setArticles(newArticles);
    reorder.mutate({
      stackId: stack.id,
      articleIds: newArticles.map((a) => a.articleId),
    });
  }

  function handleShare() {
    const url = `${window.location.origin}/stack/${stack.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Articles in library not already in this stack
  const availableArticles = libraryArticles.filter(
    (la) => !articles.some((a) => a.articleId === la.id)
  );

  const filteredAvailable = pickerSearch
    ? availableArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
          (a.siteName?.toLowerCase().includes(pickerSearch.toLowerCase()) ?? false)
      )
    : availableArticles;

  return (
    <>
      {/* Header */}
      <header className="mb-10">
        {editing ? (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
              className="text-3xl leading-tight outline-none bg-transparent"
              style={{
                fontFamily: "var(--font-lora)",
                color: "var(--ink)",
                border: "none",
                borderBottom: "2px solid var(--border)",
                paddingBottom: "4px",
              }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              maxLength={1000}
              rows={2}
              className="text-sm outline-none bg-transparent resize-none"
              style={{
                fontFamily: "var(--font-geist-sans)",
                color: "var(--ink-muted)",
                border: "none",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "4px",
              }}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setVisibility(visibility === "private" ? "public" : "private")
                }
                className="flex items-center gap-1.5 text-xs cursor-pointer"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
              >
                {visibility === "private" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    Private
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M2 7h10M7 2c-1.5 1.5-2 3.2-2 5s.5 3.5 2 5M7 2c1.5 1.5 2 3.2 2 5s-.5 3.5-2 5" stroke="currentColor" strokeWidth="1.1" />
                    </svg>
                    Public
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!title.trim() || updateStack.isPending}
                className="rounded-lg px-4 py-2 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 cursor-pointer"
                style={{ background: "var(--ink)", color: "var(--cream)", fontFamily: "var(--font-geist-sans)" }}
              >
                {updateStack.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setTitle(stack.title);
                  setDescription(stack.description ?? "");
                  setVisibility(stack.visibility);
                }}
                className="rounded-lg px-4 py-2 text-xs font-medium transition-all hover:opacity-60 cursor-pointer"
                style={{ color: "var(--ink-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-geist-sans)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1
                  className="text-3xl sm:text-4xl leading-tight mb-2"
                  style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
                >
                  {stack.title}
                </h1>
                {stack.description && (
                  <p
                    className="text-sm mb-3"
                    style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
                  >
                    {stack.description}
                  </p>
                )}
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
                >
                  {!isOwner && creator && (
                    <>
                      <span>
                        curated by <strong style={{ color: "var(--ink-muted)" }}>{creator.name}</strong>
                      </span>
                      <span>·</span>
                    </>
                  )}
                  <span>
                    {articles.length} article{articles.length === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  {stack.visibility === "public" ? (
                    <span style={{ color: "#4aad40" }}>public</span>
                  ) : (
                    <span>private</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
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
                {isOwner && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-geist-sans)",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M8.5 1.5l2 2M1 11l.5-2L9 1.5l2 2L3.5 11l-2 .5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Article list */}
      {articles.length === 0 && !showPicker ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p
            className="text-lg italic"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-lora)" }}
          >
            This stack is empty.
          </p>
          {isOwner && (
            <button
              onClick={() => setShowPicker(true)}
              className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60 cursor-pointer"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
            >
              Add your first article →
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {articles.map((article, index) => (
            <li
              key={article.articleId}
              className="flex items-center gap-3 py-4"
            >
              {/* Position number */}
              <span
                className="shrink-0 w-6 text-center text-sm font-medium"
                style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
              >
                {index + 1}
              </span>

              {/* Article info */}
              <Link
                href={`/article/${article.articleId}`}
                className="flex flex-col gap-0.5 flex-1 min-w-0 transition-opacity hover:opacity-70"
              >
                <h3
                  className="text-base leading-snug"
                  style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
                >
                  {article.title}
                </h3>
                <div
                  className="flex flex-wrap items-center gap-x-2 text-xs"
                  style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
                >
                  {article.siteName && <span>{article.siteName}</span>}
                  {article.siteName && <span>·</span>}
                  <span>
                    {article.annotationCount} highlight{article.annotationCount === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>

              {/* Owner controls */}
              {isOwner && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0 || reorder.isPending}
                    className="p-1 rounded transition-opacity hover:opacity-60 disabled:opacity-20 cursor-pointer disabled:cursor-default"
                    style={{ color: "var(--ink-muted)" }}
                    title="Move up"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 11V3M7 3l-3 3M7 3l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={index === articles.length - 1 || reorder.isPending}
                    className="p-1 rounded transition-opacity hover:opacity-60 disabled:opacity-20 cursor-pointer disabled:cursor-default"
                    style={{ color: "var(--ink-muted)" }}
                    title="Move down"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 3v8M7 11l-3-3M7 11l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemoveArticle(article.articleId)}
                    disabled={removeArticle.isPending}
                    className="p-1 rounded transition-all hover:text-red-500 disabled:opacity-40 cursor-pointer"
                    style={{ color: "var(--ink-faint)" }}
                    title="Remove from stack"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add article button / picker */}
      {isOwner && (
        <div className="mt-6">
          {showPicker ? (
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
                >
                  Add from your library
                </span>
                <button
                  onClick={() => {
                    setShowPicker(false);
                    setPickerSearch("");
                  }}
                  className="text-xs cursor-pointer transition-opacity hover:opacity-60"
                  style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
                >
                  Close
                </button>
              </div>

              {availableArticles.length > 3 && (
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search articles…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    background: "white",
                    fontFamily: "var(--font-geist-sans)",
                  }}
                  autoFocus
                />
              )}

              {filteredAvailable.length === 0 ? (
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
                >
                  {availableArticles.length === 0
                    ? "All your articles are already in this stack."
                    : "No matching articles."}
                </p>
              ) : (
                <ul
                  className="flex flex-col divide-y max-h-64 overflow-y-auto"
                  style={{ borderColor: "var(--border)" }}
                >
                  {filteredAvailable.map((article) => (
                    <li key={article.id}>
                      <button
                        onClick={() => handleAddArticle(article.id)}
                        disabled={addArticle.isPending}
                        className="w-full text-left px-2 py-3 transition-all hover:bg-black/[0.02] disabled:opacity-40 cursor-pointer"
                        style={{ fontFamily: "var(--font-geist-sans)" }}
                      >
                        <span
                          className="text-sm block"
                          style={{ color: "var(--ink)", fontFamily: "var(--font-lora)" }}
                        >
                          {article.title}
                        </span>
                        {article.siteName && (
                          <span
                            className="text-xs"
                            style={{ color: "var(--ink-faint)" }}
                          >
                            {article.siteName}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
              style={{
                border: "1px dashed var(--border)",
                color: "var(--ink-muted)",
                fontFamily: "var(--font-geist-sans)",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add article
            </button>
          )}
        </div>
      )}
    </>
  );
}
