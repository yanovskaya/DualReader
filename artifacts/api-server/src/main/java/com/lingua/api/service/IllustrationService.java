package com.lingua.api.service;

import com.lingua.api.model.ChapterIllustration;
import com.lingua.api.repository.ChapterIllustrationRepository;
import com.lingua.api.repository.ParagraphRepository;
import com.lingua.api.model.Paragraph;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        // Deduplicate consecutive identical headings and skip non-chapter sections
        List<Paragraph> unique = new ArrayList<>();
        String prevText = null;
        for (Paragraph h : chapters) {
            String text = h.getOriginalText().trim();
            if (text.equals(prevText)) continue;
            prevText = text;
            // Skip "Chapter Notes", "Chapter End Notes" and similar auxiliary sections
            String lower = text.toLowerCase();
            if (lower.contains("chapter notes") || lower.contains("end notes")
                    || lower.contains("endnotes") || lower.equals("notes")
                    || lower.equals("preface") || lower.startsWith("preface ")) continue;
            unique.add(h);
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
            sceneBrief = openAiService.complete("gpt-4.1-nano", 200,
                List.of(
                    Map.of("role", "system", "content",
                        "You are an art director for a book illustration. " +
                        "Write a visual scene brief (max 80 words) based on this chapter excerpt. " +
                        "Include: the NAMES of the characters present (e.g. Hermione Granger, Draco Malfoy, Harry Potter), " +
                        "their exact ages if mentioned (e.g. 17-year-old), physical appearance, " +
                        "the specific setting, mood, and one dramatic action or emotional moment. " +
                        "Be concrete and cinematic. Use the actual character names from the text."),
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
            "soft luminous lighting, painterly brushwork, highly detailed faces and setting, " +
            "cinematic atmosphere, tall portrait orientation (9:16), vertical composition. " +
            "Characters must be beautiful and visually attractive — elegant features, graceful expressions. " +
            "No text, no letters, no watermarks.";

        String ageGuard =
            "IMPORTANT: If characters are 17-18 years old, they are fully mature teenagers/young adults, NOT children. " +
            "All characters must look their stated age and be attractive and pleasant-looking.";

        if (sceneBrief != null && !sceneBrief.isBlank()) {
            return String.format("Interior chapter illustration. %s. %s %s",
                    sceneBrief.strip(), ageGuard, style);
        }
        return String.format(
            "Interior chapter illustration for \"%s\". " +
            "Dramatic literary scene, vivid and evocative. %s",
            chapterTitle, style
        );
    }

    public List<Map<String, Object>> getIllustrations(Integer bookId) {
        // Use metadata-only query to avoid loading imageData blobs into heap
        return illustrationRepo.findParagraphIdsByBookId(bookId).stream()
                .map(paragraphId -> {
                    java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("paragraphId", paragraphId);
                    m.put("imageUrl", "/api/books/" + bookId + "/chapter-illustrations/" + paragraphId);
                    return m;
                })
                .collect(Collectors.toList());
    }

    /** Force-clears existing illustrations for a book and re-schedules generation. */
    @Transactional
    public void forceRegenerateForBook(Integer bookId) {
        illustrationRepo.deleteByBookId(bookId);
        scheduleForBook(bookId);
    }
}
