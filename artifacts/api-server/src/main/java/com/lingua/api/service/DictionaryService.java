package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class DictionaryService {

    private final JdbcTemplate jdbc;
    private final OpenAiService openAi;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final RowMapper<Map<String, Object>> LOOKUP_MAPPER = (rs, rowNum) -> {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("word", rs.getString("word"));
        m.put("translations", toStringList(rs, "translations"));
        m.put("synonyms", toStringList(rs, "synonyms"));
        String pos = rs.getString("part_of_speech");
        m.put("partOfSpeech", pos);
        String trans = rs.getString("transcription");
        m.put("transcription", trans);
        m.put("examples", toStringList(rs, "examples"));
        m.put("exampleTranslations", toStringList(rs, "example_translations"));
        m.put("lookedUpAt", rs.getTimestamp("looked_up_at").toInstant().toString());
        return m;
    };

    private static List<String> toStringList(ResultSet rs, String column) throws SQLException {
        Array arr = rs.getArray(column);
        if (arr == null) return new ArrayList<>();
        String[] strings = (String[]) arr.getArray();
        return strings != null ? Arrays.asList(strings) : new ArrayList<>();
    }

    public Map<String, Object> lookup(String word, String context) {
        String normalizedWord = word.toLowerCase().trim();

        // Check cache
        List<Map<String, Object>> cached = jdbc.query(
                "SELECT * FROM dictionary_lookups WHERE word = ? ORDER BY looked_up_at DESC LIMIT 1",
                LOOKUP_MAPPER, normalizedWord);

        if (!cached.isEmpty()) {
            Map<String, Object> entry = cached.get(0);
            List<?> synonyms = (List<?>) entry.get("synonyms");
            if (synonyms != null && !synonyms.isEmpty()) {
                // Update timestamp
                jdbc.update("UPDATE dictionary_lookups SET looked_up_at = NOW() WHERE word = ? AND looked_up_at = (SELECT MAX(looked_up_at) FROM dictionary_lookups WHERE word = ?)",
                        normalizedWord, normalizedWord);
                entry.put("lookedUpAt", Instant.now().toString());
                return entry;
            }
        }

        // Call OpenAI
        String contextHint = (context != null && !context.isBlank())
                ? "The word appears in this sentence: \"" + context + "\"\nTranslate it as used in that specific context."
                : "";

        String systemPrompt = """
                You are an English–Russian dictionary. Respond ONLY with a JSON object — no markdown, no extra text.

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
                - NEVER translate a wrong word.""";

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", "Word to look up: \"" + word + "\"\n" + contextHint)
        );

        String content = openAi.complete("gpt-4.1-nano", 600, messages);
        content = content.replaceAll("```json\\n?|\\n?```", "").trim();

        Map<?, ?> ai;
        try {
            ai = mapper.readValue(content, Map.class);
        } catch (Exception e) {
            ai = Map.of("translations", List.of("перевод недоступен"), "examples", List.of());
        }

        String resultWord = ai.get("word") != null ? ai.get("word").toString().toLowerCase().trim() : normalizedWord;
        List<String> translations = toList(ai.get("translations"), "перевод недоступен");
        List<String> rawSynonyms = toList(ai.get("synonyms"), null);
        // Pad synonyms to same length as translations
        List<String> synonyms = new ArrayList<>();
        for (int i = 0; i < translations.size(); i++) {
            synonyms.add(i < rawSynonyms.size() ? rawSynonyms.get(i) : "");
        }
        String partOfSpeech = ai.get("partOfSpeech") != null ? ai.get("partOfSpeech").toString() : null;
        String transcription = ai.get("transcription") != null ? ai.get("transcription").toString() : null;
        List<String> examples = toList(ai.get("examples"), null);
        List<String> exampleTranslations = toList(ai.get("exampleTranslations"), null);

        // Don't cache fallback results
        boolean isFallback = translations.size() == 1 && "перевод недоступен".equals(translations.get(0));
        if (isFallback) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("word", resultWord);
            result.put("translations", translations);
            result.put("synonyms", synonyms);
            result.put("partOfSpeech", partOfSpeech);
            result.put("transcription", transcription);
            result.put("examples", examples);
            result.put("exampleTranslations", exampleTranslations);
            result.put("lookedUpAt", Instant.now().toString());
            return result;
        }

        // Insert into DB using JDBC for array support
        jdbc.update(con -> {
            var ps = con.prepareStatement(
                    "INSERT INTO dictionary_lookups (word, translations, synonyms, part_of_speech, transcription, examples, example_translations) VALUES (?, ?, ?, ?, ?, ?, ?)");
            ps.setString(1, resultWord);
            ps.setArray(2, con.createArrayOf("text", translations.toArray(String[]::new)));
            ps.setArray(3, con.createArrayOf("text", synonyms.toArray(String[]::new)));
            ps.setString(4, partOfSpeech);
            ps.setString(5, transcription);
            ps.setArray(6, con.createArrayOf("text", examples.toArray(String[]::new)));
            ps.setArray(7, con.createArrayOf("text", exampleTranslations.toArray(String[]::new)));
            return ps;
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("word", resultWord);
        result.put("translations", translations);
        result.put("synonyms", synonyms);
        result.put("partOfSpeech", partOfSpeech);
        result.put("transcription", transcription);
        result.put("examples", examples);
        result.put("exampleTranslations", exampleTranslations);
        result.put("lookedUpAt", Instant.now().toString());
        return result;
    }

    public List<Map<String, Object>> recent() {
        return jdbc.query(
                "SELECT * FROM dictionary_lookups ORDER BY looked_up_at DESC LIMIT 20",
                LOOKUP_MAPPER);
    }

    @SuppressWarnings("unchecked")
    private List<String> toList(Object value, String fallback) {
        if (value instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return fallback != null ? List.of(fallback) : new ArrayList<>();
    }
}
