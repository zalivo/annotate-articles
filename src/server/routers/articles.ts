import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { articles } from "@/db/schema";
import { eq } from "drizzle-orm";

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
