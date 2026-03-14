"use client";

import { useState } from "react";
import { LibraryArticleRow } from "./LibraryArticleRow";
import { StackCard } from "./StackCard";
import { CreateStackForm } from "./CreateStackForm";
import Link from "next/link";

interface ArticleData {
  id: string;
  title: string | null;
  siteName: string | null;
  author: string | null;
}

interface StackData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: string;
  createdAt: Date;
  articleCount: number;
}

interface Props {
  articles: ArticleData[];
  countMap: Record<string, number>;
  stacks: StackData[];
}

export function LibraryTabs({ articles, countMap, stacks }: Props) {
  const [tab, setTab] = useState<"articles" | "stacks">("articles");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"annotations" | "title" | "site">("annotations");

  const q = search.toLowerCase().trim();
  const filteredArticles = (() => {
    const filtered = q
      ? articles.filter(
          (a) =>
            a.title?.toLowerCase().includes(q) ||
            a.siteName?.toLowerCase().includes(q) ||
            a.author?.toLowerCase().includes(q)
        )
      : articles;
    if (sort === "title") return [...filtered].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    if (sort === "site") return [...filtered].sort((a, b) => (a.siteName ?? "").localeCompare(b.siteName ?? ""));
    return filtered; // already sorted by annotation count from server
  })();
  const filteredStacks = q
    ? stacks.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      )
    : stacks;

  const tabStyle = (active: boolean) => ({
    color: active ? "var(--ink)" : "var(--ink-faint)",
    fontFamily: "var(--font-geist-sans)" as const,
    borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
  });

  return (
    <>
      {/* Search */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
        style={{
          background: "var(--card)",
          border: "1.5px solid var(--border)",
          boxShadow: "0 1px 4px rgba(28,23,16,0.06)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{ flexShrink: 0, color: "var(--ink-faint)" }}
        >
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search library…"
          className="flex-1 bg-transparent outline-none text-sm"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-geist-sans)",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs cursor-pointer transition-opacity hover:opacity-60"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-6 mb-8 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setTab("articles")}
          className="pb-3 text-sm font-medium transition-colors cursor-pointer"
          style={tabStyle(tab === "articles")}
        >
          Articles ({filteredArticles.length})
        </button>
        <button
          onClick={() => setTab("stacks")}
          className="pb-3 text-sm font-medium transition-colors cursor-pointer"
          style={tabStyle(tab === "stacks")}
        >
          Stacks ({filteredStacks.length})
        </button>
      </div>

      {/* Articles tab */}
      {tab === "articles" && (
        <>
          {articles.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xs"
                style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
              >
                Sort by
              </span>
              {(["annotations", "title", "site"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className="text-xs px-2 py-1 rounded-md transition-colors cursor-pointer"
                  style={{
                    background: sort === s ? "var(--ink)" : "transparent",
                    color: sort === s ? "var(--cream)" : "var(--ink-muted)",
                    fontFamily: "var(--font-geist-sans)",
                  }}
                >
                  {s === "annotations" ? "Most annotated" : s === "title" ? "Title" : "Site"}
                </button>
              ))}
            </div>
          )}
          {articles.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p
                className="text-lg italic"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-lora)" }}
              >
                Nothing here yet.
              </p>
              <Link
                href="/"
                className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
              >
                Paste your first article →
              </Link>
            </div>
          ) : filteredArticles.length === 0 ? (
            <p
              className="text-sm py-12 text-center"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
            >
              No articles matching &ldquo;{search}&rdquo;
            </p>
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredArticles.map((article) => (
                <LibraryArticleRow
                  key={article.id}
                  article={article}
                  annotationCount={countMap[article.id] ?? 0}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* Stacks tab */}
      {tab === "stacks" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p
              className="text-sm"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
            >
              {stacks.length === 0
                ? "No stacks yet."
                : `${stacks.length} stack${stacks.length === 1 ? "" : "s"}`}
            </p>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                  fontFamily: "var(--font-geist-sans)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                New Stack
              </button>
            )}
          </div>

          {showCreateForm && (
            <CreateStackForm onClose={() => setShowCreateForm(false)} />
          )}

          {stacks.length === 0 && !showCreateForm ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p
                className="text-lg italic"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-lora)" }}
              >
                Curate your first collection.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60 cursor-pointer"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
              >
                Create a stack →
              </button>
            </div>
          ) : filteredStacks.length === 0 && q ? (
            <p
              className="text-sm py-12 text-center"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
            >
              No stacks matching &ldquo;{search}&rdquo;
            </p>
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredStacks.map((stack) => (
                <StackCard key={stack.id} stack={stack} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
