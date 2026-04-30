import { Router } from "express";
import { db } from "@workspace/db";
import { booksTable, paragraphsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { GetTranslationStatusParams, StartTranslationParams, GetParagraphTranslationParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /books/:id/translation-status
router.get("/books/:id/translation-status", async (req, res) => {
  const parsed = GetTranslationStatusParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
    if (!book) return res.status(404).json({ error: "Book not found" });

    const progressPercent = book.totalParagraphs > 0
      ? Math.round((book.translatedParagraphs / book.totalParagraphs) * 100)
      : 0;

    return res.json({
      bookId: book.id,
      status: book.translationStatus,
      totalParagraphs: book.totalParagraphs,
      translatedParagraphs: book.translatedParagraphs,
      progressPercent,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get translation status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /books/:id/translate - Start translating (SSE stream)
router.post("/books/:id/translate", async (req, res) => {
  const parsed = StartTranslationParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const batchSize = parseInt(String(req.body?.batchSize ?? "8")) || 8;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
    if (!book) {
      sendEvent({ error: "Book not found" });
      return res.end();
    }

    // Get untranslated paragraphs
    const untranslated = await db.select().from(paragraphsTable)
      .where(and(
        eq(paragraphsTable.bookId, parsed.data.id),
        eq(paragraphsTable.isTranslated, false)
      ))
      .orderBy(paragraphsTable.position);

    if (untranslated.length === 0) {
      sendEvent({ done: true, message: "All paragraphs already translated" });
      return res.end();
    }

    // Mark as in progress
    await db.update(booksTable)
      .set({ translationStatus: "in_progress" })
      .where(eq(booksTable.id, parsed.data.id));

    sendEvent({ started: true, total: untranslated.length });

    let translated = book.translatedParagraphs;

    // Process in batches
    for (let i = 0; i < untranslated.length; i += batchSize) {
      const batch = untranslated.slice(i, i + batchSize);

      // Translate batch in one LLM call for efficiency
      const textsToTranslate = batch.map((p, idx) => `[${idx + 1}] ${p.originalText}`).join("\n\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        max_completion_tokens: 8192,
        messages: [
          {
            role: "system",
            content: `You are a literary translator. Translate the following English paragraphs into Russian.
Preserve the style and tone of the original text. Each paragraph is numbered with [N].
Return ONLY the translated paragraphs in the same numbered format [N], one per line pair.
Do not add explanations or notes.`,
          },
          {
            role: "user",
            content: textsToTranslate,
          },
        ],
      });

      const translationText = response.choices[0]?.message?.content ?? "";

      // Parse numbered translations
      const translationMap = new Map<number, string>();
      const lines = translationText.split(/\n\n+/);
      for (const line of lines) {
        const match = line.match(/^\[(\d+)\]\s*([\s\S]+)/);
        if (match) {
          translationMap.set(parseInt(match[1]), match[2].trim());
        }
      }

      // Update each paragraph
      for (let j = 0; j < batch.length; j++) {
        const paragraph = batch[j];
        const translation = translationMap.get(j + 1) ?? translationText;

        await db.update(paragraphsTable)
          .set({ translatedText: translation, isTranslated: true })
          .where(eq(paragraphsTable.id, paragraph.id));

        translated++;
      }

      // Update book progress
      const isLast = i + batchSize >= untranslated.length;
      await db.update(booksTable)
        .set({
          translatedParagraphs: translated,
          translationStatus: isLast ? "completed" : "in_progress",
        })
        .where(eq(booksTable.id, parsed.data.id));

      sendEvent({
        progress: true,
        translated,
        total: book.totalParagraphs,
        percent: Math.round((translated / book.totalParagraphs) * 100),
      });

      // Small delay to avoid rate limits
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    sendEvent({ done: true });
    return res.end();
  } catch (err) {
    req.log.error({ err }, "Translation failed");
    sendEvent({ error: "Translation failed" });
    return res.end();
  }
});

// GET /paragraphs/:id/translation
router.get("/paragraphs/:id/translation", async (req, res) => {
  const parsed = GetParagraphTranslationParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    const [paragraph] = await db.select().from(paragraphsTable).where(eq(paragraphsTable.id, parsed.data.id));
    if (!paragraph) return res.status(404).json({ error: "Paragraph not found" });

    return res.json({
      id: paragraph.id,
      bookId: paragraph.bookId,
      position: paragraph.position,
      originalText: paragraph.originalText,
      translatedText: paragraph.translatedText ?? null,
      isTranslated: paragraph.isTranslated,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get paragraph translation");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
