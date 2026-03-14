import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { sharedLinks, articles, annotations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Paragraph } from "@/db/schema";
import type { Metadata } from "next";
import { ArticleReader } from "@/app/article/[id]/ArticleReader";
import { ThemeToggle } from "@/app/ThemeToggle";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.id, slug)).limit(1);
  if (!link) return { title: "Shared highlights not found" };
  const [article] = await db
    .select({ title: articles.title, siteName: articles.siteName })
    .from(articles)
    .where(eq(articles.id, link.articleId))
    .limit(1);
  if (!article) return { title: "Article not found" };
  const [creator] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, link.creatorId))
    .limit(1);
  const title = `${article.title} — Highlight Stack`;
  const description = creator
    ? `Highlights by ${creator.name}${article.siteName ? ` · ${article.siteName}` : ""}`
    : `Shared highlights${article.siteName ? ` from ${article.siteName}` : ""}`;
  const ogImage = `/api/og?title=${encodeURIComponent(article.title)}&subtitle=${encodeURIComponent(creator ? `Highlights by ${creator.name}` : "")}&type=shared`;
  return {
    title,
    description,
    openGraph: { title, description, images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function SharedPage({ params }: Props) {
  const { slug } = await params;

  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.id, slug))
    .limit(1);

  if (!link) notFound();

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, link.articleId))
    .limit(1);

  if (!article) notFound();

  const articleAnnotations = await db
    .select()
    .from(annotations)
    .where(eq(annotations.articleId, link.articleId));

  const [creator] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, link.creatorId))
    .limit(1);

  const paragraphs = article.paragraphs as Paragraph[];

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Link
          href="/"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-60"
          style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
        >
          ← Highlight Stack
        </Link>
        <ThemeToggle />
      </nav>

      {/* Attribution banner */}
      <div
        className="border-b px-6 py-3 flex items-center justify-between gap-3"
        style={{ borderColor: "var(--border)", background: "var(--cream)" }}
      >
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7M7 2h3m0 0v3m0-3L5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Read original article
        </a>
        {creator && (
          <span
            className="shrink-0 text-xs"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
          >
            annotated by <strong style={{ color: "var(--ink-muted)" }}>{creator.name}</strong>
          </span>
        )}
      </div>

      <main
        className="mx-auto px-6 py-16"
        style={{ maxWidth: "960px" }}
        data-article-container
      >
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

        <ArticleReader
          articleId={article.id}
          paragraphs={paragraphs}
          initialAnnotations={articleAnnotations}
          readOnly
        />

        <footer className="mt-16 pt-8 border-t" style={{ borderColor: "var(--border)", maxWidth: "680px" }}>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-60"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
          >
            Read the original on {article.siteName ?? new URL(article.sourceUrl).hostname} →
          </a>
        </footer>
      </main>
    </div>
  );
}
