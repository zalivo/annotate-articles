import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { SignOutButton } from "./SignOutButton";
import { LibraryTabs } from "./LibraryTabs";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/db";
import { users, articles, annotations, stacks, stackArticles } from "@/db/schema";
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
    .where(eq(users.email, supabaseUser.email))
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

  const sorted = [...userArticles].sort(
    (a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0)
  );

  // Fetch user's stacks with article counts
  const userStacks = await db
    .select({
      id: stacks.id,
      slug: stacks.slug,
      title: stacks.title,
      description: stacks.description,
      visibility: stacks.visibility,
      createdAt: stacks.createdAt,
      articleCount: sql<number>`cast(count(${stackArticles.id}) as int)`,
    })
    .from(stacks)
    .leftJoin(stackArticles, eq(stackArticles.stackId, stacks.id))
    .where(eq(stacks.creatorId, dbUser.id))
    .groupBy(stacks.id)
    .orderBy(stacks.createdAt);

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
        <header className="mb-8">
          <h1
            className="text-4xl leading-tight mb-2"
            style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
          >
            My Library
          </h1>
        </header>

        <LibraryTabs
          articles={sorted.map((a) => ({
            id: a.id,
            title: a.title,
            siteName: a.siteName,
            author: a.author,
          }))}
          countMap={countMap}
          stacks={userStacks}
        />
      </main>
    </div>
  );
}
