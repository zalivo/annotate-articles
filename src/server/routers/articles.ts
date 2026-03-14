import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { articles, annotations, stackArticles } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export const articlesRouter = router({
  ingest: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      // Check if article already ingested
      const [existing] = await ctx.db
        .select()
        .from(articles)
        .where(eq(articles.sourceUrl, input.url))
        .limit(1);

      if (existing) return existing;

      // Fetch and parse the article server-side
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.url }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Failed to ingest article");
      }

      return res.json();
    }),

  trending: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: articles.id,
        title: articles.title,
        author: articles.author,
        siteName: articles.siteName,
        sourceUrl: articles.sourceUrl,
        highlightCount: sql<number>`count(distinct ${annotations.id})`.as(
          "highlight_count"
        ),
        stackCount: sql<number>`count(distinct ${stackArticles.id})`.as(
          "stack_count"
        ),
      })
      .from(articles)
      .leftJoin(
        annotations,
        sql`${annotations.articleId} = ${articles.id} and ${annotations.visibility} = 'public'`
      )
      .leftJoin(stackArticles, eq(stackArticles.articleId, articles.id))
      .groupBy(articles.id)
      .having(
        sql`count(distinct ${annotations.id}) + count(distinct ${stackArticles.id}) > 0`
      )
      .orderBy(
        desc(
          sql`count(distinct ${annotations.id}) + count(distinct ${stackArticles.id})`
        )
      )
      .limit(5);

    return rows.map((r) => ({
      ...r,
      highlightCount: Number(r.highlightCount),
      stackCount: Number(r.stackCount),
    }));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [article] = await ctx.db
        .select()
        .from(articles)
        .where(eq(articles.id, input.id))
        .limit(1);

      if (!article) throw new Error("Article not found");
      return article;
    }),
});
