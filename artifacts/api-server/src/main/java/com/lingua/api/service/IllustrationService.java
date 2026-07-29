package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lingua.api.model.ChapterIllustration;
import com.lingua.api.repository.ChapterIllustrationRepository;
import com.lingua.api.repository.ParagraphRepository;
import com.lingua.api.model.Paragraph;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class IllustrationService {

    private static final Logger log = LoggerFactory.getLogger(IllustrationService.class);
    private static final int MAX_SCENES_PER_CHAPTER = 8;
    // Single thread so two books don't race each other on rate limits
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    // In-memory progress tracking: bookId → [doneChapters, totalChapters, isGenerating(0/1)]
    private static final ConcurrentHashMap<Integer, int[]> progressMap = new ConcurrentHashMap<>();

    // Stop flags: if a bookId is present, the running generation should abort
    private static final Set<Integer> stopFlags = ConcurrentHashMap.newKeySet();

    private final GeminiService geminiService;
    private final OpenAiService openAiService;
    private final ParagraphRepository paragraphRepo;
    private final ChapterIllustrationRepository illustrationRepo;
    private final TransactionTemplate transactionTemplate;

    /**
     * Schedules async illustration generation for all chapters of a book.
     * Called after book upload. Skips chapters that already have illustrations.
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

    /**
     * Schedules illustration generation for a single chapter.
     * Works for any heading paragraph including "technical" ones (Chapter Notes, etc.).
     * If force=true, deletes existing illustrations first and regenerates from scratch.
     * Otherwise skips if the chapter already has MAX_SCENES_PER_CHAPTER illustrations.
     */
    public void scheduleForChapter(Integer bookId, Integer paragraphId, boolean force) {
        executor.submit(() -> {
            try {
                List<Paragraph> all = paragraphRepo.findByBookIdOrderByPosition(bookId);
                Paragraph heading = all.stream()
                        .filter(p -> p.getId().equals(paragraphId))
                        .findFirst()
                        .orElse(null);
                if (heading == null) {
                    log.warn("Book {}: paragraph {} not found for single-chapter generation", bookId, paragraphId);
                    return;
                }
                if (force) {
                    // @Modifying queries need a transaction; executor thread has none → use TransactionTemplate
                    transactionTemplate.execute(status -> {
                        illustrationRepo.deleteByBookIdAndParagraphId(bookId, paragraphId);
                        return null;
                    });
                    log.info("Book {}: cleared illustrations for chapter '{}' (force regenerate)", bookId, heading.getOriginalText());
                }
                long existing = illustrationRepo.countByBookIdAndParagraphId(bookId, paragraphId);
                if (!force && existing >= MAX_SCENES_PER_CHAPTER) {
                    log.info("Book {}: chapter '{}' already has {} illustrations, skipping",
                            bookId, heading.getOriginalText(), existing);
                    return;
                }
                log.info("Book {}: generating illustrations for chapter '{}'", bookId, heading.getOriginalText());
                String fullText = extractFullChapter(all, heading);
                generateScenesForChapter(bookId, heading, fullText, (int) existing);
                log.info("Book {}: chapter generation complete for '{}'", bookId, heading.getOriginalText());
            } catch (Exception e) {
                log.warn("Book {}: chapter generation failed for paragraph {}: {}", bookId, paragraphId, e.getMessage());
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
            String lower = text.toLowerCase();
            if (lower.contains("chapter notes") || lower.contains("end notes")
                    || lower.contains("endnotes") || lower.equals("notes")
                    || lower.equals("preface") || lower.startsWith("preface ")) continue;
            unique.add(h);
        }

        log.info("Book {}: generating illustrations for {} chapters (up to {} scenes each)",
                bookId, unique.size(), MAX_SCENES_PER_CHAPTER);

        stopFlags.remove(bookId);
        progressMap.put(bookId, new int[]{0, unique.size(), 1});

        for (Paragraph heading : unique) {
            if (stopFlags.contains(bookId)) {
                log.info("Book {}: generation stopped by user after {} chapters", bookId,
                        progressMap.getOrDefault(bookId, new int[]{0})[0]);
                break;
            }
            try {
                long existing = illustrationRepo.countByBookIdAndParagraphId(bookId, heading.getId());
                if (existing >= MAX_SCENES_PER_CHAPTER) {
                    log.debug("Book {}: chapter '{}' already has {} illustrations, skipping",
                            bookId, heading.getOriginalText(), existing);
                    progressMap.computeIfPresent(bookId, (k, v) -> { v[0]++; return v; });
                    continue;
                }

                String fullText = extractFullChapter(all, heading);
                generateScenesForChapter(bookId, heading, fullText, (int) existing);
                progressMap.computeIfPresent(bookId, (k, v) -> { v[0]++; return v; });

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Book {}: illustration generation interrupted", bookId);
                return;
            } catch (Exception e) {
                log.warn("Book {}: failed for chapter '{}': {}", bookId, heading.getOriginalText(), e.getMessage());
            }
        }

        stopFlags.remove(bookId);
        progressMap.computeIfPresent(bookId, (k, v) -> { v[2] = 0; return v; });
        log.info("Book {}: illustration generation complete", bookId);
    }

    /**
     * Collects the full chapter body text (all paragraphs until the next heading).
     * Capped at 14 000 characters so it fits comfortably in a GPT context window.
     */
    private String extractFullChapter(List<Paragraph> all, Paragraph heading) {
        List<String> body = new ArrayList<>();
        for (Paragraph p : all) {
            if (p.getPosition() <= heading.getPosition()) continue;
            if (BookService.isHeading(p.getOriginalText())) break;
            String text = p.getOriginalText().trim();
            if (!text.isEmpty()) body.add(text);
        }
        if (body.isEmpty()) return "";
        String full = String.join("\n\n", body);
        // Cap at 40k chars (~10k tokens) — covers even very long chapters fully
        return full.length() > 40_000 ? full.substring(0, 40_000) + "\n[... chapter continues ...]" : full;
    }

    /**
     * Generates illustrations for key scenes in a chapter, starting from sceneOffset.
     * GPT reads the full chapter text and writes ready-to-use image prompts directly.
     */
    private void generateScenesForChapter(Integer bookId, Paragraph heading,
                                           String fullText, int sceneOffset) throws Exception {
        int toGenerate = MAX_SCENES_PER_CHAPTER - sceneOffset;
        if (toGenerate <= 0) return;

        List<String> imagePrompts = generateImagePrompts(heading.getOriginalText(), fullText, toGenerate);
        if (imagePrompts.isEmpty()) {
            // Fallback: single illustration from chapter title
            imagePrompts = List.of(
                "Interior chapter illustration for \"" + heading.getOriginalText() + "\". " +
                "Dramatic literary scene, vivid and evocative. " +
                "Style: professional digital painting, book illustration art, vibrant rich colors, " +
                "cinematic atmosphere, tall portrait orientation (9:16). No text, no watermarks."
            );
        }

        for (int i = 0; i < imagePrompts.size(); i++) {
            if (stopFlags.contains(bookId)) {
                log.info("Book {}: stop flag detected mid-chapter '{}', aborting remaining scenes",
                        bookId, heading.getOriginalText());
                return;
            }
            try {
                String prompt = imagePrompts.get(i);
                byte[] imageBytes = generateImageWithRetry(prompt, heading.getOriginalText(), 3);
                if (imageBytes == null) {
                    log.warn("Book {}: illustration returned null for chapter '{}' scene {}",
                            bookId, heading.getOriginalText(), sceneOffset + i);
                    continue;
                }

                ChapterIllustration illus = new ChapterIllustration();
                illus.setBookId(bookId);
                illus.setParagraphId(heading.getId());
                illus.setSceneIndex(sceneOffset + i);
                illus.setImageData(imageBytes);
                illustrationRepo.save(illus);

                log.info("Book {}: saved illustration for chapter '{}' scene {} ({} KB)",
                        bookId, heading.getOriginalText(), sceneOffset + i, imageBytes.length / 1024);

                if (i < imagePrompts.size() - 1) {
                    Thread.sleep(3000);
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.warn("Book {}: scene {} failed for '{}': {}",
                        bookId, sceneOffset + i, heading.getOriginalText(), e.getMessage());
            }
        }
    }

    /**
     * Reads the FULL chapter text and returns ready-to-use image generation prompts —
     * GPT decides how many scenes (1–maxScenes), which moments to pick, and writes
     * each prompt directly (no intermediate brief step).
     */
    private List<String> generateImagePrompts(String chapterTitle, String fullText, int maxScenes) {
        if (fullText.isBlank()) return List.of();
        try {
            String styleBlock =
                "Art style for every prompt: professional digital painting, book illustration art, " +
                "vibrant rich colors, saturated jewel-toned palette, sharp crisp detail, " +
                "soft luminous lighting, painterly brushwork, highly detailed faces and setting, " +
                "cinematic atmosphere, tall portrait orientation (9:16), vertical composition. " +
                "Characters must be beautiful and visually attractive — elegant features, graceful expressions. " +
                "No text, no letters, no watermarks.";

            String ageRule =
                "Age rule: every character must be drawn at their EXACT stated age. " +
                "Teenagers (13–17) look like real teenagers — not children, not adults. " +
                "Young adults (18–25) look young but fully grown. Always include exact age in the prompt.";

            String raw = openAiService.complete("gpt-4.1-mini", 6000,
                List.of(
                    Map.of("role", "system", "content",
                        "You are both an art director and an AI image prompt engineer. " +
                        "You will read a full book chapter and produce ready-to-use prompts for an AI image model. " +
                        "\n\nYour task:\n" +
                        "1. Read the chapter carefully and understand the full arc of events.\n" +
                        "2. Choose between 1 and " + maxScenes + " scenes to illustrate " +
                        "(short/transitional chapters → 1–2; medium → 3–4; long/rich chapters → 5–8). " +
                        "Prioritize the most dramatic, emotional, and visually interesting moments. " +
                        "Spread the scenes across the chapter — beginning, middle, end. " +
                        "Each scene must depict a DIFFERENT event or moment.\n" +
                        "3. For each chosen scene, write one complete image generation prompt (100–150 words). " +
                        "The prompt must include: exact setting description, character names and their EXACT AGE " +
                        "(e.g. '16-year-old Harry'), physical appearance (hair, eyes, clothing), " +
                        "the specific action or emotional beat happening, lighting, mood, and art style.\n" +
                        "\n" + ageRule + "\n\n" + styleBlock + "\n\n" +
                        "Return ONLY a JSON array of prompt strings, e.g. [\"prompt1\", \"prompt2\"]. No other text."),
                    Map.of("role", "user", "content",
                        "Chapter title: " + chapterTitle + "\n\n" + fullText)
                )
            );

            log.info("GPT raw response for '{}': {}", chapterTitle,
                raw.length() > 500 ? raw.substring(0, 500) + "..." : raw);

            String trimmed = raw.strip();
            // Strip markdown code fences if present
            if (trimmed.startsWith("```")) {
                trimmed = trimmed.replaceAll("(?s)^```[a-zA-Z]*\\n?", "").replaceAll("(?s)```\\s*$", "").strip();
            }
            // If GPT wrapped the array in an object, try to extract the array
            if (!trimmed.startsWith("[")) {
                int start = trimmed.indexOf('[');
                int end   = trimmed.lastIndexOf(']');
                if (start >= 0 && end > start) trimmed = trimmed.substring(start, end + 1);
            }
            ObjectMapper mapper = new ObjectMapper();
            @SuppressWarnings("unchecked")
            List<String> prompts = mapper.readValue(trimmed, List.class);
            if (prompts.size() > maxScenes) prompts = prompts.subList(0, maxScenes);
            log.info("GPT generated {} image prompts for chapter '{}'", prompts.size(), chapterTitle);
            return prompts;
        } catch (Exception e) {
            log.warn("Image prompt generation failed for '{}': {} — {}", chapterTitle,
                e.getClass().getSimpleName(), e.getMessage());
            return List.of();
        }
    }

    private byte[] generateImageWithRetry(String prompt, String label, int maxRetries) {
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return geminiService.generateImage(prompt, "gemini-3-pro-image");
            } catch (Exception e) {
                boolean rateLimit = e.getMessage() != null && e.getMessage().contains("429");
                if (rateLimit && attempt < maxRetries) {
                    long delay = 5000L * attempt;
                    log.info("Rate limit hit for '{}', retrying in {}ms (attempt {}/{})",
                            label, delay, attempt, maxRetries);
                    try { Thread.sleep(delay); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return null; }
                } else {
                    log.warn("Image generation failed for '{}': {}", label, e.getMessage());
                    return null;
                }
            }
        }
        return null;
    }


    public List<Map<String, Object>> getIllustrations(Integer bookId) {
        // Use metadata-only query to avoid loading imageData blobs into heap
        return illustrationRepo.findMetadataByBookId(bookId).stream()
                .map(row -> {
                    Integer ilId = ((Number) row[0]).intValue();
                    Integer paragraphId = ((Number) row[1]).intValue();
                    Integer sceneIndex = ((Number) row[2]).intValue();
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("illustrationId", ilId);
                    m.put("paragraphId", paragraphId);
                    m.put("sceneIndex", sceneIndex);
                    m.put("imageUrl", "/api/books/" + bookId + "/chapter-illustrations/" + ilId);
                    return m;
                })
                .collect(Collectors.toList());
    }

    /** Returns current generation progress for a book. */
    public Map<String, Object> getProgress(Integer bookId) {
        int[] p = progressMap.get(bookId);
        boolean generating = p != null && p[2] == 1;
        int done = p != null ? p[0] : 0;
        int total = p != null ? p[1] : 0;
        long saved = illustrationRepo.countByBookId(bookId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("isGenerating", generating);
        m.put("doneChapters", done);
        m.put("totalChapters", total);
        m.put("savedIllustrations", (int) saved);
        return m;
    }

    /** Force-clears existing illustrations for a book and re-schedules generation. */
    @Transactional
    public void forceRegenerateForBook(Integer bookId) {
        stopFlags.add(bookId); // stop any running generation first
        illustrationRepo.deleteByBookId(bookId);
        // Give the running thread a moment to notice the stop flag before we clear it
        try { Thread.sleep(200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        scheduleForBook(bookId);
    }

    /** Signals any active generation for this book to stop after the current scene. */
    public void stopGeneration(Integer bookId) {
        stopFlags.add(bookId);
        progressMap.computeIfPresent(bookId, (k, v) -> { v[2] = 0; return v; });
        log.info("Book {}: stop requested", bookId);
    }
}
