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

  const tabStyle = (active: boolean) => ({
    color: active ? "var(--ink)" : "var(--ink-faint)",
    fontFamily: "var(--font-geist-sans)" as const,
    borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
  });

  return (
    <>
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
          Articles ({articles.length})
        </button>
        <button
          onClick={() => setTab("stacks")}
          className="pb-3 text-sm font-medium transition-colors cursor-pointer"
          style={tabStyle(tab === "stacks")}
        >
          Stacks ({stacks.length})
        </button>
      </div>

      {/* Articles tab */}
      {tab === "articles" && (
        <>
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
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {articles.map((article) => (
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
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {stacks.map((stack) => (
                <StackCard key={stack.id} stack={stack} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
