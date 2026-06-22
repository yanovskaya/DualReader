package com.lingua.api.service;

import com.lingua.api.model.ChapterIllustration;
import com.lingua.api.repository.ChapterIllustrationRepository;
import com.lingua.api.repository.ParagraphRepository;
import com.lingua.api.model.Paragraph;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IllustrationService {

    private static final Logger log = LoggerFactory.getLogger(IllustrationService.class);
    // Single thread so two books don't race each other on rate limits
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    private final GeminiService geminiService;
    private final OpenAiService openAiService;
    private final ParagraphRepository paragraphRepo;
    private final ChapterIllustrationRepository illustrationRepo;

    /**
     * Schedules async illustration generation for all chapters of a book.
     * Called after book upload. Skips chapters that already have an illustration.
     */
    public void scheduleForBook(Integer bookId) {
        executor.submit(() -> {
            try {
                generateForBook(bookId);
            } catch (Exception e) {
                log.warn("Illustration generation failed for book {}: {}", bookId, e.getMessage());
            }
        });
    }

    private void generateForBook(Integer bookId) {
        List<Paragraph> all = paragraphRepo.findByBookIdOrderByPosition(bookId);
        if (all.isEmpty()) return;

        List<Paragraph> chapters = all.stream()
                .filter(p -> BookService.isHeading(p.getOriginalText()))
                .collect(Collectors.toList());

        // Deduplicate consecutive identical headings
        List<Paragraph> unique = new ArrayList<>();
        String prevText = null;
        for (Paragraph h : chapters) {
            if (!h.getOriginalText().equals(prevText)) {
                unique.add(h);
                prevText = h.getOriginalText();
            }
        }

        log.info("Book {}: generating illustrations for {} chapters", bookId, unique.size());

        for (Paragraph heading : unique) {
            try {
                if (illustrationRepo.existsByBookIdAndParagraphId(bookId, heading.getId())) {
                    log.debug("Book {}: illustration already exists for paragraph {}, skipping", bookId, heading.getId());
                    continue;
                }

                // Collect up to 5 prose paragraphs after the heading for context
                String excerpt = all.stream()
                        .filter(p -> p.getPosition() > heading.getPosition()
                                && p.getPosition() <= heading.getPosition() + 8
                                && !BookService.isHeading(p.getOriginalText()))
                        .limit(5)
                        .map(Paragraph::getOriginalText)
                        .collect(Collectors.joining("\n\n"));

                byte[] imageBytes = generateIllustrationWithRetry(heading.getOriginalText(), excerpt, 3);
                if (imageBytes == null) {
                    log.warn("Book {}: illustration generation returned null for chapter '{}'",
                            bookId, heading.getOriginalText());
                    continue;
                }

                ChapterIllustration illus = new ChapterIllustration();
                illus.setBookId(bookId);
                illus.setParagraphId(heading.getId());
                illus.setImageData(imageBytes);
                illustrationRepo.save(illus);

                log.info("Book {}: saved illustration for chapter '{}' ({} KB)",
                        bookId, heading.getOriginalText(), imageBytes.length / 1024);

                // Pause between chapters to avoid rate limits
                Thread.sleep(3000);

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Book {}: illustration generation interrupted", bookId);
                return;
            } catch (Exception e) {
                log.warn("Book {}: failed for chapter '{}': {}", bookId, heading.getOriginalText(), e.getMessage());
            }
        }

        log.info("Book {}: illustration generation complete", bookId);
    }

    private byte[] generateIllustrationWithRetry(String chapterTitle, String excerpt, int maxRetries) {
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return generateIllustration(chapterTitle, excerpt);
            } catch (Exception e) {
                boolean rateLimit = e.getMessage() != null && e.getMessage().contains("429");
                if (rateLimit && attempt < maxRetries) {
                    long delay = 5000L * attempt;
                    log.info("Rate limit hit for '{}', retrying in {}ms (attempt {}/{})",
                            chapterTitle, delay, attempt, maxRetries);
                    try { Thread.sleep(delay); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return null; }
                } else {
                    log.warn("Illustration generation failed for '{}': {}", chapterTitle, e.getMessage());
                    return null;
                }
            }
        }
        return null;
    }

    private byte[] generateIllustration(String chapterTitle, String excerpt) throws Exception {
        // Use GPT to write a concise scene brief — skip if excerpt is empty
        String sceneBrief = null;
        if (!excerpt.isBlank()) {
            sceneBrief = openAiService.complete("gpt-4.1-nano", 150,
                List.of(
                    Map.of("role", "system", "content",
                        "You are an art director. Write a short visual scene brief (max 60 words) " +
                        "for an interior book illustration based on this chapter excerpt. " +
                        "Describe the setting, mood, and one dramatic moment. Be specific and visual. No character names needed."),
                    Map.of("role", "user", "content",
                        "Chapter: " + chapterTitle + "\n\n" + excerpt.substring(0, Math.min(800, excerpt.length())))
                )
            );
        }

        String prompt = buildIllustrationPrompt(chapterTitle, sceneBrief);
        return geminiService.generateImage(prompt, "gemini-3-pro-image-preview");
    }

    private String buildIllustrationPrompt(String chapterTitle, String sceneBrief) {
        String style =
            "Style: professional digital painting, book illustration art, " +
            "vibrant rich colors, saturated jewel-toned palette, sharp crisp detail, " +
            "soft luminous lighting, painterly brushwork, highly detailed setting, " +
            "cinematic atmosphere, wide landscape orientation (16:9). " +
            "No text, no letters, no watermarks.";

        if (sceneBrief != null && !sceneBrief.isBlank()) {
            return String.format("Interior chapter illustration. %s. %s", sceneBrief.strip(), style);
        }
        return String.format(
            "Interior chapter illustration for \"%s\". " +
            "Dramatic literary scene, vivid and evocative. %s",
            chapterTitle, style
        );
    }

    public List<Map<String, Object>> getIllustrations(Integer bookId) {
        return illustrationRepo.findByBookIdOrderByParagraphId(bookId).stream()
                .map(i -> {
                    java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("paragraphId", i.getParagraphId());
                    m.put("imageUrl", "/api/books/" + bookId + "/chapter-illustrations/" + i.getParagraphId());
                    return m;
                })
                .collect(Collectors.toList());
    }
}
