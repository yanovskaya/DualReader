import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const translationStatusEnum = pgEnum("translation_status", ["pending", "in_progress", "completed"]);

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  language: text("language").notNull().default("en"),
  totalParagraphs: integer("total_paragraphs").notNull().default(0),
  translatedParagraphs: integer("translated_paragraphs").notNull().default(0),
  translationStatus: translationStatusEnum("translation_status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true, totalParagraphs: true, translatedParagraphs: true, translationStatus: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;
