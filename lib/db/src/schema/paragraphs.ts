import { pgTable, serial, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { booksTable } from "./books";

export const paragraphsTable = pgTable("paragraphs", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text"),
  isTranslated: boolean("is_translated").notNull().default(false),
});

export const insertParagraphSchema = createInsertSchema(paragraphsTable).omit({ id: true });
export type InsertParagraph = z.infer<typeof insertParagraphSchema>;
export type Paragraph = typeof paragraphsTable.$inferSelect;
