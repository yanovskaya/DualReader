import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dictionaryLookupsTable = pgTable("dictionary_lookups", {
  id: serial("id").primaryKey(),
  word: text("word").notNull(),
  translations: text("translations").array().notNull().default([]),
  partOfSpeech: text("part_of_speech"),
  examples: text("examples").array().notNull().default([]),
  lookedUpAt: timestamp("looked_up_at").defaultNow().notNull(),
});

export const insertDictionaryLookupSchema = createInsertSchema(dictionaryLookupsTable).omit({ id: true, lookedUpAt: true });
export type InsertDictionaryLookup = z.infer<typeof insertDictionaryLookupSchema>;
export type DictionaryLookup = typeof dictionaryLookupsTable.$inferSelect;
