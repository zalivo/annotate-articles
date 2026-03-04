import { notFound } from "next/navigation";
import { db } from "@/db";
import { articles, annotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Paragraph } from "@/db/schema";
import type { Metadata } from "next";
import { ArticleReader } from "./ArticleReader";
import { ShareButton } from "./ShareButton";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [article] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!article) return { title: "Article not found" };
  return {
    title: `${article.title} — Annotate`,
    description: article.author
      ? `Annotated article by ${article.author}${article.siteName ? ` · ${article.siteName}` : ""}`
      : `Annotated article${article.siteName ? ` from ${article.siteName}` : ""}`,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) notFound();

  const existingAnnotations = await db
    .select()
    .from(annotations)
    .where(eq(annotations.articleId, id));

  const paragraphs = article.paragraphs as Paragraph[];

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <a
          href="/"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
        >
          ← Annotate
        </a>
        <a
          href="/library"
          className="text-sm transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
        >
          My Library
        </a>
      </nav>

      {/* Attribution banner */}
      <div
        className="border-b px-6 py-3 flex items-center gap-3"
        style={{ borderColor: "var(--border)", background: "var(--cream)" }}
      >
        <span
          className="text-xs tracking-widest uppercase shrink-0"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
        >
          Original
        </span>
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm truncate underline underline-offset-2 hover:opacity-60 transition-opacity flex-1"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
        >
          {article.sourceUrl}
        </a>
        <ShareButton articleId={id} />
      </div>

      {/* Article content */}
      <main
        className="mx-auto px-6 py-16"
        style={{ maxWidth: "960px" }}
        data-article-container
      >
        {/* Header */}
        <header className="mb-12" style={{ maxWidth: "680px" }}>
          <h1
            className="text-4xl sm:text-5xl leading-tight mb-4"
            style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
          >
            {article.title}
          </h1>

          {(article.author || article.siteName) && (
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
            >
              {article.author && <span>{article.author}</span>}
              {article.author && article.siteName && (
                <span style={{ color: "var(--ink-faint)" }}>·</span>
              )}
              {article.siteName && <span>{article.siteName}</span>}
            </div>
          )}
        </header>

        {/* Interactive reader */}
        <ArticleReader
          articleId={id}
          paragraphs={paragraphs}
          initialAnnotations={existingAnnotations}
        />

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t" style={{ borderColor: "var(--border)", maxWidth: "680px" }}>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-60"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5.5 8.5a3 3 0 0 0 4.5 0l1.5-1.5a3 3 0 0 0-4.5-4L6 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M8.5 5.5a3 3 0 0 0-4.5 0L2.5 7a3 3 0 0 0 4.5 4l.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Read on {article.siteName ?? new URL(article.sourceUrl).hostname}
          </a>
        </footer>
      </main>
    </div>
  );
}
