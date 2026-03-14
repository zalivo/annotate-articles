import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/db";
import { articles, annotations, users, stacks, stackArticles } from "@/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import type { Paragraph } from "@/db/schema";
import type { Metadata } from "next";
import { ArticleReader } from "./ArticleReader";
import { ShareButton } from "./ShareButton";
import { AddToStackButton } from "./AddToStackButton";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [article] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!article) return { title: "Article not found" };
  return {
    title: `${article.title} — Highlight Stack`,
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

  // Resolve current user (if signed in)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  let currentUserId: string | null = null;
  if (supabaseUser?.email) {
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, supabaseUser.email))
      .limit(1);
    currentUserId = dbUser?.id ?? null;
  }

  // Fetch user's stacks for "Add to Stack" button
  const userStacks = currentUserId
    ? await db
        .select({
          id: stacks.id,
          title: stacks.title,
          slug: stacks.slug,
        })
        .from(stacks)
        .where(eq(stacks.creatorId, currentUserId))
        .orderBy(stacks.createdAt)
    : [];

  // Check which stacks already contain this article
  const stacksWithArticle = currentUserId && userStacks.length > 0
    ? await db
        .select({ stackId: stackArticles.stackId })
        .from(stackArticles)
        .where(
          and(
            eq(stackArticles.articleId, id),
            sql`${stackArticles.stackId} IN (${sql.join(
              userStacks.map((s) => sql`${s.id}`),
              sql`, `
            )})`
          )
        )
    : [];

  const stackIdsWithArticle = new Set(stacksWithArticle.map((r) => r.stackId));

  // Fetch own annotations (all) + others' public annotations
  const existingAnnotations = currentUserId
    ? await db
        .select({
          id: annotations.id,
          articleId: annotations.articleId,
          creatorId: annotations.creatorId,
          startParagraphId: annotations.startParagraphId,
          startOffset: annotations.startOffset,
          endParagraphId: annotations.endParagraphId,
          endOffset: annotations.endOffset,
          highlightedText: annotations.highlightedText,
          comment: annotations.comment,
          color: annotations.color,
          visibility: annotations.visibility,
          createdAt: annotations.createdAt,
          updatedAt: annotations.updatedAt,
          creatorName: users.name,
        })
        .from(annotations)
        .leftJoin(users, eq(users.id, annotations.creatorId))
        .where(and(
          eq(annotations.articleId, id),
          or(
            eq(annotations.creatorId, currentUserId),
            eq(annotations.visibility, "public"),
          ),
        ))
    : await db
        .select({
          id: annotations.id,
          articleId: annotations.articleId,
          creatorId: annotations.creatorId,
          startParagraphId: annotations.startParagraphId,
          startOffset: annotations.startOffset,
          endParagraphId: annotations.endParagraphId,
          endOffset: annotations.endOffset,
          highlightedText: annotations.highlightedText,
          comment: annotations.comment,
          color: annotations.color,
          visibility: annotations.visibility,
          createdAt: annotations.createdAt,
          updatedAt: annotations.updatedAt,
          creatorName: users.name,
        })
        .from(annotations)
        .leftJoin(users, eq(users.id, annotations.creatorId))
        .where(and(
          eq(annotations.articleId, id),
          eq(annotations.visibility, "public"),
        ));

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
        <Link
          href="/library"
          className="text-sm transition-opacity hover:opacity-60"
          style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
        >
          My Library
        </Link>
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
        <div className="flex items-center gap-2">
          {currentUserId && (
            <AddToStackButton
              articleId={id}
              stacks={userStacks.map((s) => ({
                ...s,
                hasArticle: stackIdsWithArticle.has(s.id),
              }))}
            />
          )}
          <ShareButton articleId={id} />
        </div>
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
          currentUserId={currentUserId ?? undefined}
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
