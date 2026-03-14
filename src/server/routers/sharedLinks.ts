import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { sharedLinks, articles, annotations, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export const sharedLinksRouter = router({
  create: protectedProcedure
    .input(z.object({ articleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a shared link for this article
      const [existing] = await ctx.db
        .select()
        .from(sharedLinks)
        .where(eq(sharedLinks.articleId, input.articleId))
        .limit(1);

      if (existing) return existing;

      const slug = nanoid(8);
      const [link] = await ctx.db
        .insert(sharedLinks)
        .values({
          id: slug,
          articleId: input.articleId,
          creatorId: ctx.user.id,
        })
        .returning();

      return link;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [link] = await ctx.db
        .select()
        .from(sharedLinks)
        .where(eq(sharedLinks.id, input.slug))
        .limit(1);

      if (!link) throw new Error("Shared link not found");

      const [article] = await ctx.db
        .select()
        .from(articles)
        .where(eq(articles.id, link.articleId))
        .limit(1);

      const articleAnnotations = await ctx.db
        .select()
        .from(annotations)
        .where(and(
          eq(annotations.articleId, link.articleId),
          eq(annotations.creatorId, link.creatorId),
        ));

      const [creator] = await ctx.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, link.creatorId))
        .limit(1);

      return { link, article, annotations: articleAnnotations, creator };
    }),
});
