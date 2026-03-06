import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { LibraryArticleRow } from "./LibraryArticleRow";
import { SignOutButton } from "./SignOutButton";
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    redirect("/auth?next=/library");
  }

  // Single query: user info + annotation counts per article via LEFT JOIN
  const userWithAnnotations = await db
    .select({
      userId: users.id,
      userName: users.name,
      articleId: annotations.articleId,
      count: sql<number>`cast(count(${annotations.id}) as int)`,
    })
    .from(users)
    .leftJoin(annotations, eq(annotations.creatorId, users.id))
    .where(eq(users.email, session.user.email))
    .groupBy(users.id, users.name, annotations.articleId);

  if (!userWithAnnotations.length) redirect("/auth?next=/library");

  const dbUser = { id: userWithAnnotations[0].userId, name: userWithAnnotations[0].userName };
  const annotationCounts = userWithAnnotations.filter((r) => r.articleId !== null) as {
    articleId: string;
    count: number;
  }[];

  const articleIds = annotationCounts.map((r) => r.articleId);

  const userArticles =
    articleIds.length > 0
      ? await db.select().from(articles).where(inArray(articles.id, articleIds))
      : [];

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
        <div className="flex items-center gap-4">
          <span
            className="text-xs"
            style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
          >
            {dbUser.name}
          </span>
          <SignOutButton />
        </div>
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
