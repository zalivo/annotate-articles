import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { stacks, stackArticles, articles, annotations, users } from "@/db/schema";
import { eq, and, sql, inArray, asc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const stacksRouter = router({
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      visibility: z.enum(["private", "public"]).default("private"),
    }))
    .mutation(async ({ ctx, input }) => {
      const slug = nanoid(10);
      const [stack] = await ctx.db
        .insert(stacks)
        .values({
          slug,
          creatorId: ctx.user.id,
          title: input.title,
          description: input.description,
          visibility: input.visibility,
        })
        .returning();
      return stack;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      visibility: z.enum(["private", "public"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.title !== undefined) set.title = fields.title;
      if (fields.description !== undefined) set.description = fields.description;
      if (fields.visibility !== undefined) set.visibility = fields.visibility;

      const [updated] = await ctx.db
        .update(stacks)
        .set(set)
        .where(and(eq(stacks.id, id), eq(stacks.creatorId, ctx.user.id)))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(stacks)
        .where(and(eq(stacks.id, input.id), eq(stacks.creatorId, ctx.user.id)));
    }),

  addArticle: protectedProcedure
    .input(z.object({
      stackId: z.string().uuid(),
      articleId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [stack] = await ctx.db
        .select({ id: stacks.id })
        .from(stacks)
        .where(and(eq(stacks.id, input.stackId), eq(stacks.creatorId, ctx.user.id)))
        .limit(1);
      if (!stack) throw new Error("Stack not found");

      // Get next position
      const [last] = await ctx.db
        .select({ maxPos: sql<number>`coalesce(max(${stackArticles.position}), -1)` })
        .from(stackArticles)
        .where(eq(stackArticles.stackId, input.stackId));

      const [entry] = await ctx.db
        .insert(stackArticles)
        .values({
          stackId: input.stackId,
          articleId: input.articleId,
          position: (last?.maxPos ?? -1) + 1,
        })
        .returning();
      return entry;
    }),

  removeArticle: protectedProcedure
    .input(z.object({
      stackId: z.string().uuid(),
      articleId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [stack] = await ctx.db
        .select({ id: stacks.id })
        .from(stacks)
        .where(and(eq(stacks.id, input.stackId), eq(stacks.creatorId, ctx.user.id)))
        .limit(1);
      if (!stack) throw new Error("Stack not found");

      await ctx.db
        .delete(stackArticles)
        .where(and(
          eq(stackArticles.stackId, input.stackId),
          eq(stackArticles.articleId, input.articleId),
        ));
    }),

  reorderArticles: protectedProcedure
    .input(z.object({
      stackId: z.string().uuid(),
      articleIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [stack] = await ctx.db
        .select({ id: stacks.id })
        .from(stacks)
        .where(and(eq(stacks.id, input.stackId), eq(stacks.creatorId, ctx.user.id)))
        .limit(1);
      if (!stack) throw new Error("Stack not found");

      // Update positions
      await Promise.all(
        input.articleIds.map((articleId, i) =>
          ctx.db
            .update(stackArticles)
            .set({ position: i })
            .where(and(
              eq(stackArticles.stackId, input.stackId),
              eq(stackArticles.articleId, articleId),
            ))
        )
      );
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const userStacks = await ctx.db
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
      .where(eq(stacks.creatorId, ctx.user.id))
      .groupBy(stacks.id)
      .orderBy(stacks.createdAt);
    return userStacks;
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [stack] = await ctx.db
        .select()
        .from(stacks)
        .where(eq(stacks.slug, input.slug))
        .limit(1);

      if (!stack) throw new Error("Stack not found");

      // If private, only owner can view
      if (stack.visibility === "private" && stack.creatorId !== ctx.user?.id) {
        throw new Error("Stack not found");
      }

      const [creator] = await ctx.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, stack.creatorId))
        .limit(1);

      // Get articles in order with annotation counts from the stack creator
      const stackItems = await ctx.db
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

      // Get annotation counts per article for the stack creator
      const articleIds = stackItems.map((item) => item.articleId);
      const annotationCounts = articleIds.length > 0
        ? await ctx.db
            .select({
              articleId: annotations.articleId,
              count: sql<number>`cast(count(${annotations.id}) as int)`,
            })
            .from(annotations)
            .where(and(
              inArray(annotations.articleId, articleIds),
              eq(annotations.creatorId, stack.creatorId),
            ))
            .groupBy(annotations.articleId)
        : [];

      const countMap = Object.fromEntries(
        annotationCounts.map((r) => [r.articleId, r.count])
      );

      const articlesWithCounts = stackItems.map((item) => ({
        ...item,
        annotationCount: countMap[item.articleId] ?? 0,
      }));

      return { stack, creator, articles: articlesWithCounts };
    }),
});
