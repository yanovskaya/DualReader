package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingua.api.model.Book;
import com.lingua.api.model.Paragraph;
import com.lingua.api.repository.BookRepository;
import com.lingua.api.repository.ParagraphRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationService {

    private final BookRepository bookRepo;
    private final ParagraphRepository paragraphRepo;
    private final OpenAiService openAi;
    private final ObjectMapper mapper = new ObjectMapper();

    @Async("translationExecutor")
    public void translateBook(Integer bookId, int batchSize, SseEmitter emitter) {
        try {
            Optional<Book> optBook = bookRepo.findById(bookId);
            if (optBook.isEmpty()) {
                send(emitter, Map.of("error", "Book not found"));
                emitter.complete();
                return;
            }

            Book book = optBook.get();
            boolean americanize = book.isConvertBritishToAmerican();
            List<Paragraph> untranslated = paragraphRepo.findByBookIdAndIsTranslatedFalseOrderByPosition(bookId);

            if (untranslated.isEmpty()) {
                send(emitter, Map.of("done", true, "message", "All paragraphs already translated"));
                emitter.complete();
                return;
            }

            book.setTranslationStatus("in_progress");
            bookRepo.save(book);

            send(emitter, Map.of("started", true, "total", untranslated.size()));

            int translated = book.getTranslatedParagraphs();

            for (int i = 0; i < untranslated.size(); i += batchSize) {
                List<Paragraph> batch = untranslated.subList(i, Math.min(i + batchSize, untranslated.size()));
                boolean isLast = (i + batchSize) >= untranslated.size();

                // ── Step 1: Americanize (optional) ───────────────────────────────────
                if (americanize) {
                    batch = americanizeBatch(batch);
                }

                // ── Step 2: Translate to Russian (with retry) ─────────────────────────
                String translationText = null;
                int[] backoffMs = {2_000, 5_000, 10_000};
                for (int attempt = 0; attempt <= backoffMs.length; attempt++) {
                    try {
                        StringBuilder textsToTranslate = new StringBuilder();
                        for (int j = 0; j < batch.size(); j++) {
                            textsToTranslate.append("[").append(j + 1).append("] ").append(batch.get(j).getOriginalText());
                            if (j < batch.size() - 1) textsToTranslate.append("\n\n");
                        }
                        List<Map<String, String>> messages = List.of(
                                Map.of("role", "system", "content",
                                        "You are a translator. Translate the following English paragraphs into Russian. " +
                                        "Stay as close to the original wording as possible while keeping the Russian grammatically natural and readable. " +
                                        "Do NOT paraphrase, summarize, expand, or add anything not present in the source. " +
                                        "Translate every word; omit nothing. " +
                                        "Each paragraph is numbered with [N]. " +
                                        "Return ONLY the translated paragraphs in the same numbered format [N]. " +
                                        "No explanations, no notes, no additions."),
                                Map.of("role", "user", "content", textsToTranslate.toString())
                        );
                        translationText = openAi.complete("gpt-4.1-mini", 8192, messages);
                        break; // success
                    } catch (Exception ex) {
                        if (attempt < backoffMs.length) {
                            log.warn("Translation batch {}/{} attempt {} failed: {} — retrying in {}ms",
                                    i / batchSize + 1, (untranslated.size() + batchSize - 1) / batchSize,
                                    attempt + 1, ex.getMessage(), backoffMs[attempt]);
                            Thread.sleep(backoffMs[attempt]);
                        } else {
                            log.error("Translation batch {}/{} failed after all retries — skipping batch: {}",
                                    i / batchSize + 1, (untranslated.size() + batchSize - 1) / batchSize, ex.getMessage());
                        }
                    }
                }

                // ── Step 3: Parse and save ────────────────────────────────────────────
                if (translationText != null) {
                    Map<Integer, String> translationMap = new HashMap<>();
                    for (String line : translationText.split("\n\n+")) {
                        Matcher m = Pattern.compile("^\\[(\\d+)\\]\\s*([\\s\\S]+)").matcher(line.trim());
                        if (m.find()) {
                            translationMap.put(Integer.parseInt(m.group(1)), m.group(2).trim());
                        }
                    }
                    for (int j = 0; j < batch.size(); j++) {
                        Paragraph paragraph = batch.get(j);
                        String translation = translationMap.get(j + 1);
                        if (translation != null && !translation.isBlank()) {
                            paragraph.setTranslatedText(translation);
                            paragraph.setTranslated(true);
                            paragraphRepo.save(paragraph);
                            translated++;
                        }
                    }
                }
                // if translationText == null (all retries exhausted) — skip batch, continue

                book = bookRepo.findById(bookId).orElse(book);
                book.setTranslatedParagraphs(translated);
                book.setTranslationStatus(isLast ? "completed" : "in_progress");
                bookRepo.save(book);

                int pct = book.getTotalParagraphs() > 0
                        ? Math.round((float) translated / book.getTotalParagraphs() * 100)
                        : 0;
                send(emitter, Map.of("progress", true, "translated", translated, "total", book.getTotalParagraphs(), "percent", pct));

                if (!isLast) {
                    Thread.sleep(200);
                }
            }

            send(emitter, Map.of("done", true));
            emitter.complete();

        } catch (Exception e) {
            try {
                send(emitter, Map.of("error", "Translation failed: " + e.getMessage()));
                emitter.complete();
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        }
    }

    /**
     * Calls GPT to convert a batch of paragraphs from British to American English.
     * Updates each paragraph's originalText in-place and persists to DB.
     */
    private List<Paragraph> americanizeBatch(List<Paragraph> batch) {
        StringBuilder sb = new StringBuilder();
        for (int j = 0; j < batch.size(); j++) {
            sb.append("[").append(j + 1).append("] ").append(batch.get(j).getOriginalText());
            if (j < batch.size() - 1) sb.append("\n\n");
        }

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content",
                        "You are an editor converting British English to American English. " +
                        "Convert spelling, vocabulary, and idioms to their American equivalents " +
                        "(e.g. colour→color, realise→realize, flat→apartment, autumn→fall, " +
                        "biscuit→cookie, lorry→truck, mum→mom, whilst→while, etc.). " +
                        "Each paragraph is numbered [N]. " +
                        "Return ONLY the converted paragraphs in the same numbered format [N]. " +
                        "Do not add explanations or notes."),
                Map.of("role", "user", "content", sb.toString())
        );

        try {
            String result = openAi.complete("gpt-4.1-mini", 8192, messages);
            Map<Integer, String> converted = new HashMap<>();
            for (String line : result.split("\n\n+")) {
                Matcher m = Pattern.compile("^\\[(\\d+)\\]\\s*([\\s\\S]+)").matcher(line.trim());
                if (m.find()) {
                    converted.put(Integer.parseInt(m.group(1)), m.group(2).trim());
                }
            }
            for (int j = 0; j < batch.size(); j++) {
                String american = converted.get(j + 1);
                if (american != null && !american.isBlank()) {
                    batch.get(j).setOriginalText(american);
                    paragraphRepo.save(batch.get(j));
                }
            }
        } catch (Exception e) {
            log.warn("Americanize batch failed, continuing with original text: {}", e.getMessage());
        }

        return batch;
    }

    private void send(SseEmitter emitter, Map<String, Object> data) {
        try {
            emitter.send(SseEmitter.event().data(mapper.writeValueAsString(data)));
        } catch (Exception e) {
            // Client disconnected
        }
    }
}
