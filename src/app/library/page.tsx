import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { LibraryArticleRow } from "./LibraryArticleRow";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/db";
import { users, articles, annotations } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Library — Highlight Stack",
};

export default async function LibraryPage() {
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

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser?.email) {
    redirect("/auth?next=/library");
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, supabaseUser.email))
    .limit(1);

  if (!dbUser) redirect("/auth?next=/library");

  // Articles the user has annotated, with annotation counts
  const annotationCounts = await db
    .select({
      articleId: annotations.articleId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(annotations)
    .where(eq(annotations.creatorId, dbUser.id))
    .groupBy(annotations.articleId);

  const articleIds = annotationCounts.map((r) => r.articleId);

  const userArticles =
    articleIds.length > 0
      ? await db
          .select()
          .from(articles)
          .where(inArray(articles.id, articleIds))
      : [];

  // Map articleId → count for easy lookup
  const countMap = Object.fromEntries(
    annotationCounts.map((r) => [r.articleId, r.count])
  );

  // Sort by most recently annotated (annotation count as a proxy — articles don't have per-user timestamps)
  const sorted = [...userArticles].sort(
    (a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0)
  );

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
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
        >
          ← Highlight Stack
        </Link>
        <span
          className="text-xs"
          style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
        >
          {dbUser.name}
        </span>
      </nav>

      <main className="mx-auto px-6 py-16" style={{ maxWidth: "720px" }}>
        <header className="mb-12">
          <h1
            className="text-4xl leading-tight mb-2"
            style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
          >
            My Library
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
          >
            {userArticles.length === 0
              ? "No annotated articles yet."
              : `${userArticles.length} article${userArticles.length === 1 ? "" : "s"}`}
          </p>
        </header>

        {userArticles.length === 0 ? (
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
            {sorted.map((article) => (
              <LibraryArticleRow
                key={article.id}
                article={article}
                annotationCount={countMap[article.id] ?? 0}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
