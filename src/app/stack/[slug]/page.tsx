import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/db";
import { stacks, stackArticles, articles, annotations, users } from "@/db/schema";
import { eq, and, sql, inArray, asc } from "drizzle-orm";
import type { Metadata } from "next";
import { StackDetail } from "./StackDetail";
import { ThemeToggle } from "@/app/ThemeToggle";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [stack] = await db
    .select({ title: stacks.title, description: stacks.description })
    .from(stacks)
    .where(eq(stacks.slug, slug))
    .limit(1);
  if (!stack) return { title: "Stack not found" };
  const title = `${stack.title} — Highlight Stack`;
  const description = stack.description ?? `A curated collection of articles`;
  const ogImage = `/api/og?title=${encodeURIComponent(stack.title)}&subtitle=${encodeURIComponent(stack.description ?? "")}&type=stack`;
  return {
    title,
    description,
    openGraph: { title, description, images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function StackPage({ params }: Props) {
  const { slug } = await params;

  const [stack] = await db.select().from(stacks).where(eq(stacks.slug, slug)).limit(1);
  if (!stack) notFound();

  // Resolve current user
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

  const isOwner = currentUserId === stack.creatorId;

  // If private and not owner, 404
  if (stack.visibility === "private" && !isOwner) notFound();

  // Get creator info
  const [creator] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, stack.creatorId))
    .limit(1);

  // Get articles in order
  const stackItems = await db
    .select({
      articleId: stackArticles.articleId,
      position: stackArticles.position,
      title: articles.title,
      author: articles.author,
      siteName: articles.siteName,
      sourceUrl: articles.sourceUrl,
    })
    .from(stackArticles)
    .innerJoin(articles, eq(articles.id, stackArticles.articleId))
    .where(eq(stackArticles.stackId, stack.id))
    .orderBy(asc(stackArticles.position));

  // Get annotation counts for the stack creator
  const articleIds = stackItems.map((item) => item.articleId);
  const annotationCounts =
    articleIds.length > 0
      ? await db
          .select({
            articleId: annotations.articleId,
            count: sql<number>`cast(count(${annotations.id}) as int)`,
          })
          .from(annotations)
          .where(
            and(
              inArray(annotations.articleId, articleIds),
              eq(annotations.creatorId, stack.creatorId)
            )
          )
          .groupBy(annotations.articleId)
      : [];

  const countMap = Object.fromEntries(
    annotationCounts.map((r) => [r.articleId, r.count])
  );

  const articlesWithCounts = stackItems.map((item) => ({
    ...item,
    annotationCount: countMap[item.articleId] ?? 0,
  }));

  // If owner, also fetch all their library articles (for the "add article" picker)
  let libraryArticles: { id: string; title: string; siteName: string | null }[] = [];
  if (isOwner) {
    const ownAnnotationArticleIds = await db
      .select({ articleId: annotations.articleId })
      .from(annotations)
      .where(eq(annotations.creatorId, currentUserId!))
      .groupBy(annotations.articleId);

    const ids = ownAnnotationArticleIds.map((r) => r.articleId);
    if (ids.length > 0) {
      libraryArticles = await db
        .select({ id: articles.id, title: articles.title, siteName: articles.siteName })
        .from(articles)
        .where(inArray(articles.id, ids));
    }
  }

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
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/library"
            className="text-sm transition-opacity hover:opacity-60"
            style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
          >
            My Library
          </Link>
        </div>
      </nav>

      <main className="mx-auto px-6 py-16" style={{ maxWidth: "720px" }}>
        <StackDetail
          stack={stack}
          creator={creator}
          articles={articlesWithCounts}
          isOwner={isOwner}
          libraryArticles={libraryArticles}
        />
      </main>
    </div>
  );
}
