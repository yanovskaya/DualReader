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
    // Check if we have a cached result with new fields
    const [cached] = await db.select()
      .from(dictionaryLookupsTable)
      .where(eq(dictionaryLookupsTable.word, normalizedWord))
      .orderBy(desc(dictionaryLookupsTable.lookedUpAt))
      .limit(1);

    if (cached) {
      // Only use cache if it already has synonyms (entries before this feature have synonyms=[]).
      const hasSynonyms = cached.synonyms && cached.synonyms.length > 0;
      if (hasSynonyms) {
        await db.update(dictionaryLookupsTable)
          .set({ lookedUpAt: new Date() })
          .where(eq(dictionaryLookupsTable.id, cached.id));

        return res.json({
          word: cached.word,
          translations: cached.translations,
          synonyms: cached.synonyms,
          partOfSpeech: cached.partOfSpeech ?? undefined,
          transcription: cached.transcription ?? undefined,
          examples: cached.examples,
          exampleTranslations: cached.exampleTranslations,
          lookedUpAt: new Date().toISOString(),
        });
      }
    }

    // Prompt: phrasal verb detection + transcription + example translations
    const contextHint = context
      ? `The word appears in this sentence: "${context}"\nTranslate it as used in that specific context.`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are an English–Russian dictionary. Respond ONLY with a JSON object — no markdown, no extra text.

JSON format:
{
  "word": "the word or full phrasal verb",
  "translations": ["перевод1", "перевод2"],
  "synonyms": ["synonym1", "synonym2"],
  "partOfSpeech": "noun|verb|adjective|adverb|phrasal verb|preposition|conjunction|pronoun|interjection",
  "transcription": "/AmE IPA/",
  "examples": ["English example 1.", "English example 2."],
  "exampleTranslations": ["Русский перевод 1.", "Русский перевод 2."]
}

Rules:
- "word": if the queried word is PART of a common phrasal verb (e.g. "put" in "put up with"), return the FULL phrasal verb. Otherwise return the word as-is.
- "translations": 1–3 Russian translations, context-appropriate first.
- "synonyms": for EACH translation, the single closest English synonym that best captures that specific meaning. Must be the same length as "translations". Use a word different from "word" itself.
- "transcription": American English IPA in slashes, e.g. /wɔːtər/. For phrasal verbs omit it.
- "examples": 2 short natural English sentences using the word/phrasal verb.
- "exampleTranslations": Russian translation of EACH example — same count, same order as "examples".
- NEVER translate a wrong word.`,
        },
        {
          role: "user",
          content: `Word to look up: "${word}"\n${contextHint}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let ai: {
      word?: string;
      translations?: string[];
      synonyms?: string[];
      partOfSpeech?: string;
      transcription?: string;
      examples?: string[];
      exampleTranslations?: string[];
    } = {};

    try {
      ai = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      ai = { translations: ["перевод недоступен"], examples: [] };
    }

    const resultWord = (ai.word ?? normalizedWord).toLowerCase().trim();
    const translations = ai.translations ?? ["перевод недоступен"];
    // Ensure synonyms array is same length as translations; pad with "" if needed
    const rawSynonyms = ai.synonyms ?? [];
    const synonyms = translations.map((_, i) => rawSynonyms[i] ?? "");
    const partOfSpeech = ai.partOfSpeech ?? null;
    const transcription = ai.transcription ?? null;
    const examples = ai.examples ?? [];
    const exampleTranslations = ai.exampleTranslations ?? [];

    // Store in DB
    await db.insert(dictionaryLookupsTable).values({
      word: resultWord,
      translations,
      synonyms,
      partOfSpeech,
      transcription,
      examples,
      exampleTranslations,
    });

    return res.json({
      word: resultWord,
      translations,
      synonyms,
      partOfSpeech: partOfSpeech ?? undefined,
      transcription: transcription ?? undefined,
      examples,
      exampleTranslations,
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
      synonyms: entry.synonyms,
      partOfSpeech: entry.partOfSpeech ?? undefined,
      transcription: entry.transcription ?? undefined,
      examples: entry.examples,
      exampleTranslations: entry.exampleTranslations,
      lookedUpAt: entry.lookedUpAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recent lookups");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
