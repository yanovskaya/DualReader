import { Router } from "express";
import { db } from "@workspace/db";
import { dictionaryLookupsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { LookupWordQueryParams } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";

const router = Router();

// GET /dictionary/lookup?word=...&context=...
router.get("/dictionary/lookup", async (req, res) => {
  const parsed = LookupWordQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing required parameter: word" });
  }

  const { word, context } = parsed.data;
  const normalizedWord = word.toLowerCase().trim();

  try {
    // Check if we have a recent cached result
    const [cached] = await db.select()
      .from(dictionaryLookupsTable)
      .where(eq(dictionaryLookupsTable.word, normalizedWord))
      .orderBy(desc(dictionaryLookupsTable.lookedUpAt))
      .limit(1);

    if (cached) {
      // Update the timestamp
      await db.update(dictionaryLookupsTable)
        .set({ lookedUpAt: new Date() })
        .where(eq(dictionaryLookupsTable.id, cached.id));

      return res.json({
        word: cached.word,
        translations: cached.translations,
        partOfSpeech: cached.partOfSpeech ?? undefined,
        examples: cached.examples,
        lookedUpAt: new Date().toISOString(),
      });
    }

    // Look up via OpenAI — context-aware translation
    const prompt = context
      ? `Translate the English word "${word}" as it is used in this sentence:\n"${context}"\n\nGive the Russian translation that fits this exact context and meaning.`
      : `Translate the English word "${word}" to Russian.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      max_completion_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are an English-Russian dictionary assistant. Respond ONLY with a JSON object in this exact format, no extra text:
{
  "translations": ["перевод1", "перевод2"],
  "partOfSpeech": "noun|verb|adjective|adverb|preposition|conjunction|pronoun|interjection",
  "examples": ["Short English example 1.", "Short English example 2."]
}

Rules:
- translations must be Russian words/phrases that match the word's meaning IN THE GIVEN CONTEXT
- give 1-3 translations, most contextually appropriate first
- examples must be short English sentences showing natural usage
- NEVER mix up the target word with another word`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed_result: { translations?: string[]; partOfSpeech?: string; examples?: string[] } = {};

    try {
      parsed_result = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
    } catch {
      parsed_result = { translations: ["перевод недоступен"], examples: [] };
    }

    const translations = parsed_result.translations ?? ["перевод недоступен"];
    const partOfSpeech = parsed_result.partOfSpeech ?? null;
    const examples = parsed_result.examples ?? [];

    // Store in DB
    await db.insert(dictionaryLookupsTable).values({
      word: normalizedWord,
      translations,
      partOfSpeech,
      examples,
    });

    return res.json({
      word: normalizedWord,
      translations,
      partOfSpeech: partOfSpeech ?? undefined,
      examples,
      lookedUpAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Dictionary lookup failed");
    return res.status(500).json({ error: "Dictionary lookup failed" });
  }
});

// GET /dictionary/recent
router.get("/dictionary/recent", async (req, res) => {
  try {
    const recent = await db.select()
      .from(dictionaryLookupsTable)
      .orderBy(desc(dictionaryLookupsTable.lookedUpAt))
      .limit(20);

    return res.json(recent.map(entry => ({
      word: entry.word,
      translations: entry.translations,
      partOfSpeech: entry.partOfSpeech ?? undefined,
      examples: entry.examples,
      lookedUpAt: entry.lookedUpAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recent lookups");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
