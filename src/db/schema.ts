import { pgTable, text, timestamp, jsonb, integer, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  siteName: text("site_name"),
  publishedDate: timestamp("published_date"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  paragraphs: jsonb("paragraphs").notNull().$type<Paragraph[]>(),
});

export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startParagraphId: text("start_paragraph_id").notNull(),
  startOffset: integer("start_offset").notNull(),
  endParagraphId: text("end_paragraph_id").notNull(),
  endOffset: integer("end_offset").notNull(),
  highlightedText: text("highlighted_text").notNull(),
  comment: text("comment"),
  color: text("color").notNull().default("yellow"),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sharedLinks = pgTable("shared_links", {
  id: text("id").primaryKey(), // short slug e.g. "a7x9k2"
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stacks = pgTable("stacks", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stackArticles = pgTable("stack_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  stackId: uuid("stack_id")
    .notNull()
    .references(() => stacks.id, { onDelete: "cascade" }),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Paragraph = {
  id: string;
  text: string;
  html: string;
  type: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote" | "li";
};
