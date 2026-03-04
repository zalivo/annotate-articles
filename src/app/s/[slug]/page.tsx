import { notFound } from "next/navigation";
import { db } from "@/db";
import { sharedLinks, articles, annotations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Paragraph } from "@/db/schema";
import { ArticleReader } from "@/app/article/[id]/ArticleReader";

interface Props {
  params: Promise<{ slug: string }>;
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
      {/* Attribution banner */}
      <div
        className="border-b px-6 py-3 flex items-center gap-3"
        style={{ borderColor: "var(--border)" }}
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
