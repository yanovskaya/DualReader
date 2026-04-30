import { Router } from "express";
import { db } from "@workspace/db";
import { booksTable, paragraphsTable } from "@workspace/db";
import { CreateBookBody, GetBookParams, DeleteBookParams, GetBookStatsParams } from "@workspace/api-zod";
import { eq, count, and, sql } from "drizzle-orm";

const router = Router();

// GET /books - list all books
router.get("/books", async (req, res) => {
  try {
    const books = await db.select().from(booksTable).orderBy(booksTable.createdAt);
    res.json(books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author ?? undefined,
      language: b.language,
      totalParagraphs: b.totalParagraphs,
      translatedParagraphs: b.translatedParagraphs,
      translationStatus: b.translationStatus,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list books");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /books - create/upload a book
router.post("/books", async (req, res) => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const { title, author, language, content } = parsed.data;

  try {
    // Split content into paragraphs
    const rawParagraphs = content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 10);

    const [book] = await db.insert(booksTable).values({
      title,
      author: author ?? null,
      language: language ?? "en",
      totalParagraphs: rawParagraphs.length,
      translatedParagraphs: 0,
      translationStatus: "pending",
    }).returning();

    // Insert paragraphs
    if (rawParagraphs.length > 0) {
      const paragraphValues = rawParagraphs.map((text, idx) => ({
        bookId: book.id,
        position: idx,
        originalText: text,
        translatedText: null,
        isTranslated: false,
      }));

      // Insert in batches of 100
      for (let i = 0; i < paragraphValues.length; i += 100) {
        await db.insert(paragraphsTable).values(paragraphValues.slice(i, i + 100));
      }
    }

    return res.status(201).json({
      id: book.id,
      title: book.title,
      author: book.author ?? undefined,
      language: book.language,
      totalParagraphs: book.totalParagraphs,
      translatedParagraphs: book.translatedParagraphs,
      translationStatus: book.translationStatus,
      createdAt: book.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /books/:id - get a book
router.get("/books/:id", async (req, res) => {
  const parsed = GetBookParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
    if (!book) return res.status(404).json({ error: "Book not found" });

    return res.json({
      id: book.id,
      title: book.title,
      author: book.author ?? undefined,
      language: book.language,
      totalParagraphs: book.totalParagraphs,
      translatedParagraphs: book.translatedParagraphs,
      translationStatus: book.translationStatus,
      createdAt: book.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /books/:id
router.delete("/books/:id", async (req, res) => {
  const parsed = DeleteBookParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    await db.delete(booksTable).where(eq(booksTable.id, parsed.data.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /books/:id/paragraphs
router.get("/books/:id/paragraphs", async (req, res) => {
  const parsed = GetBookParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"))));
  const offset = (page - 1) * pageSize;

  try {
    const [{ total }] = await db.select({ total: count() }).from(paragraphsTable).where(eq(paragraphsTable.bookId, parsed.data.id));

    const paragraphs = await db.select().from(paragraphsTable)
      .where(eq(paragraphsTable.bookId, parsed.data.id))
      .orderBy(paragraphsTable.position)
      .limit(pageSize)
      .offset(offset);

    return res.json({
      paragraphs: paragraphs.map(p => ({
        id: p.id,
        bookId: p.bookId,
        position: p.position,
        originalText: p.originalText,
        translatedText: p.translatedText ?? null,
        isTranslated: p.isTranslated,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list paragraphs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Heading detection — mirrors client-side isHeadingParagraph in sentences.ts
function isHeading(text: string): boolean {
  const t = text.trim();
  if (t.length > 120) return false;
  if (/^\d+\.\s+\S/.test(t)) return true;
  if (/^(chapter|part|section|prologue|epilogue|afterword|foreword|preface|act|scene|book)\b/i.test(t)) return true;
  if (/^[IVXLCDM]+\.?\s*$/.test(t)) return true;
  if (t.length <= 60 && t === t.toUpperCase() && /^[A-Z][A-Z\s\d'"-]{2,}$/.test(t)) return true;
  return false;
}

// GET /books/:id/chapters
router.get("/books/:id/chapters", async (req, res) => {
  const parsed = GetBookParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    const book = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id)).limit(1);
    if (!book.length) return res.status(404).json({ error: "Book not found" });

    // Fetch all paragraphs ordered by position; filter headings server-side
    const paragraphs = await db.select({
      id: paragraphsTable.id,
      position: paragraphsTable.position,
      originalText: paragraphsTable.originalText,
      translatedText: paragraphsTable.translatedText,
    }).from(paragraphsTable)
      .where(eq(paragraphsTable.bookId, parsed.data.id))
      .orderBy(paragraphsTable.position);

    const chapters = paragraphs.filter(p => isHeading(p.originalText)).map(p => ({
      id: p.id,
      position: p.position,
      originalText: p.originalText,
      translatedText: p.translatedText ?? null,
    }));

    return res.json({ chapters });
  } catch (err) {
    req.log.error({ err }, "Failed to get chapters");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /books/:id/stats
router.get("/books/:id/stats", async (req, res) => {
  const parsed = GetBookStatsParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
    if (!book) return res.status(404).json({ error: "Book not found" });

    // Count total words in original paragraphs
    const wordCountResult = await db.execute<{ total_words: string }>(
      sql`SELECT SUM(array_length(regexp_split_to_array(trim(original_text), '\\s+'), 1)) as total_words FROM paragraphs WHERE book_id = ${parsed.data.id}`
    );
    const wordCount = parseInt(String((wordCountResult.rows[0] as any)?.total_words ?? "0")) || 0;

    const progressPercent = book.totalParagraphs > 0
      ? Math.round((book.translatedParagraphs / book.totalParagraphs) * 100)
      : 0;

    return res.json({
      bookId: book.id,
      totalParagraphs: book.totalParagraphs,
      translatedParagraphs: book.translatedParagraphs,
      wordCount,
      uniqueWordsLookedUp: 0,
      progressPercent,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get book stats");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
