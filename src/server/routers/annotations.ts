import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { annotations, users } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

const annotationInput = z.object({
  articleId: z.string().uuid(),
  startParagraphId: z.string(),
  startOffset: z.number().int().min(0),
  endParagraphId: z.string(),
  endOffset: z.number().int().min(0),
  highlightedText: z.string().min(1),
  comment: z.string().optional(),
  color: z.string().default("yellow"),
  visibility: z.enum(["private", "public"]).default("private"),
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
    .input(z.object({
      id: z.string().uuid(),
      comment: z.string().min(1).optional(),
      visibility: z.enum(["private", "public"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.comment !== undefined) set.comment = fields.comment;
      if (fields.visibility !== undefined) set.visibility = fields.visibility;

      const [updated] = await ctx.db
        .update(annotations)
        .set(set)
        .where(
          and(
            eq(annotations.id, id),
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

  setAllVisibility: protectedProcedure
    .input(z.object({
      articleId: z.string().uuid(),
      visibility: z.enum(["private", "public"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(annotations)
        .set({ visibility: input.visibility, updatedAt: new Date() })
        .where(
          and(
            eq(annotations.articleId, input.articleId),
            eq(annotations.creatorId, ctx.user.id)
          )
        );
    }),

  listByArticle: publicProcedure
    .input(z.object({
      articleId: z.string().uuid(),
      creatorId: z.string().uuid().optional(),
      viewerId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { articleId, creatorId, viewerId } = input;

      // If filtering by a specific creator (e.g. shared link), return all of theirs
      if (creatorId) {
        return ctx.db
          .select()
          .from(annotations)
          .where(and(
            eq(annotations.articleId, articleId),
            eq(annotations.creatorId, creatorId),
          ))
          .orderBy(annotations.createdAt);
      }

      // Otherwise: return viewer's own (all) + others' public annotations
      if (viewerId) {
        const rows = await ctx.db
          .select({
            id: annotations.id,
            articleId: annotations.articleId,
            creatorId: annotations.creatorId,
            startParagraphId: annotations.startParagraphId,
            startOffset: annotations.startOffset,
            endParagraphId: annotations.endParagraphId,
            endOffset: annotations.endOffset,
            highlightedText: annotations.highlightedText,
            comment: annotations.comment,
            color: annotations.color,
            visibility: annotations.visibility,
            createdAt: annotations.createdAt,
            updatedAt: annotations.updatedAt,
            creatorName: users.name,
          })
          .from(annotations)
          .leftJoin(users, eq(users.id, annotations.creatorId))
          .where(and(
            eq(annotations.articleId, articleId),
            or(
              eq(annotations.creatorId, viewerId),
              eq(annotations.visibility, "public"),
            ),
          ))
          .orderBy(annotations.createdAt);
        return rows;
      }

      // No viewer — only public annotations
      return ctx.db
        .select({
          id: annotations.id,
          articleId: annotations.articleId,
          creatorId: annotations.creatorId,
          startParagraphId: annotations.startParagraphId,
          startOffset: annotations.startOffset,
          endParagraphId: annotations.endParagraphId,
          endOffset: annotations.endOffset,
          highlightedText: annotations.highlightedText,
          comment: annotations.comment,
          color: annotations.color,
          visibility: annotations.visibility,
          createdAt: annotations.createdAt,
          updatedAt: annotations.updatedAt,
          creatorName: users.name,
        })
        .from(annotations)
        .leftJoin(users, eq(users.id, annotations.creatorId))
        .where(and(
          eq(annotations.articleId, articleId),
          eq(annotations.visibility, "public"),
        ))
        .orderBy(annotations.createdAt);
    }),
});
