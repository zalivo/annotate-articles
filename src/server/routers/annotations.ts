import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { annotations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const annotationInput = z.object({
  articleId: z.string().uuid(),
  startParagraphId: z.string(),
  startOffset: z.number().int().min(0),
  endParagraphId: z.string(),
  endOffset: z.number().int().min(0),
  highlightedText: z.string().min(1),
  comment: z.string().optional(),
  color: z.string().default("yellow"),
});

export const annotationsRouter = router({
  create: protectedProcedure
    .input(annotationInput)
    .mutation(async ({ ctx, input }) => {
      const [annotation] = await ctx.db
        .insert(annotations)
        .values({ ...input, creatorId: ctx.user.id })
        .returning();
      return annotation;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), comment: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(annotations)
        .set({ comment: input.comment, updatedAt: new Date() })
        .where(
          and(
            eq(annotations.id, input.id),
            eq(annotations.creatorId, ctx.user.id)
          )
        )
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(annotations)
        .where(
          and(
            eq(annotations.id, input.id),
            eq(annotations.creatorId, ctx.user.id)
          )
        );
    }),

  deleteAllByArticle: protectedProcedure
    .input(z.object({ articleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(annotations)
        .where(
          and(
            eq(annotations.articleId, input.articleId),
            eq(annotations.creatorId, ctx.user.id)
          )
        );
    }),

  listByArticle: publicProcedure
    .input(z.object({ articleId: z.string().uuid(), creatorId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(annotations.articleId, input.articleId)];
      if (input.creatorId) {
        conditions.push(eq(annotations.creatorId, input.creatorId));
      }
      return ctx.db
        .select()
        .from(annotations)
        .where(and(...conditions))
        .orderBy(annotations.createdAt);
    }),
});
