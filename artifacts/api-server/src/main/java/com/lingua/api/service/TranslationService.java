package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingua.api.model.Book;
import com.lingua.api.model.Paragraph;
import com.lingua.api.repository.BookRepository;
import com.lingua.api.repository.ParagraphRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

                StringBuilder textsToTranslate = new StringBuilder();
                for (int j = 0; j < batch.size(); j++) {
                    textsToTranslate.append("[").append(j + 1).append("] ").append(batch.get(j).getOriginalText());
                    if (j < batch.size() - 1) textsToTranslate.append("\n\n");
                }

                List<Map<String, String>> messages = List.of(
                        Map.of("role", "system", "content",
                                "You are a literary translator. Translate the following English paragraphs into Russian. " +
                                "Preserve the style and tone of the original text. Each paragraph is numbered with [N]. " +
                                "Return ONLY the translated paragraphs in the same numbered format [N], one per line pair. " +
                                "Do not add explanations or notes."),
                        Map.of("role", "user", "content", textsToTranslate.toString())
                );

                String translationText = openAi.complete("gpt-4.1-mini", 8192, messages);

                Map<Integer, String> translationMap = new HashMap<>();
                for (String line : translationText.split("\n\n+")) {
                    Matcher m = Pattern.compile("^\\[(\\d+)\\]\\s*([\\s\\S]+)").matcher(line.trim());
                    if (m.find()) {
                        translationMap.put(Integer.parseInt(m.group(1)), m.group(2).trim());
                    }
                }

                for (int j = 0; j < batch.size(); j++) {
                    Paragraph paragraph = batch.get(j);
                    String translation = translationMap.getOrDefault(j + 1, translationText);
                    paragraph.setTranslatedText(translation);
                    paragraph.setTranslated(true);
                    paragraphRepo.save(paragraph);
                    translated++;
                }

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

    private void send(SseEmitter emitter, Map<String, Object> data) {
        try {
            emitter.send(SseEmitter.event().data(mapper.writeValueAsString(data)));
        } catch (Exception e) {
            // Client disconnected
        }
    }
}
