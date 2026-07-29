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
    private static final int MAX_SCENES_PER_CHAPTER = 5;
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

                String excerpt = extractExcerpt(all, heading);
                generateScenesForChapter(bookId, heading, excerpt, (int) existing);
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

    private String extractExcerpt(List<Paragraph> all, Paragraph heading) {
        // Collect ALL body paragraphs in this chapter (until the next heading)
        List<String> body = new ArrayList<>();
        for (Paragraph p : all) {
            if (p.getPosition() <= heading.getPosition()) continue;
            if (BookService.isHeading(p.getOriginalText())) break;
            String text = p.getOriginalText().trim();
            if (!text.isEmpty()) body.add(text);
        }

        if (body.isEmpty()) return "";
        if (body.size() <= 9) return String.join("\n\n", body);

        // Sample beginning + middle + end so GPT sees the full arc
        List<String> sampled = new ArrayList<>();
        int n = body.size();

        // First 3
        sampled.addAll(body.subList(0, 3));
        sampled.add("[...]");

        // Middle 3
        int mid = n / 2;
        int mFrom = Math.max(3, mid - 1);
        int mTo   = Math.min(n - 3, mid + 2);
        if (mFrom < mTo) sampled.addAll(body.subList(mFrom, mTo));
        sampled.add("[...]");

        // Last 3
        sampled.addAll(body.subList(n - 3, n));

        return String.join("\n\n", sampled);
    }

    /**
     * Generates illustrations for key scenes in a chapter, starting from sceneOffset.
     * Uses GPT to identify distinct key scenes, then generates one image per scene.
     */
    private void generateScenesForChapter(Integer bookId, Paragraph heading,
                                           String excerpt, int sceneOffset) throws Exception {
        int toGenerate = MAX_SCENES_PER_CHAPTER - sceneOffset;
        if (toGenerate <= 0) return;

        List<String> sceneBriefs = identifyKeyScenes(heading.getOriginalText(), excerpt, toGenerate);
        if (sceneBriefs.isEmpty()) {
            // Fallback: single illustration from chapter title
            sceneBriefs = List.of((String) null);
        }

        for (int i = 0; i < sceneBriefs.size(); i++) {
            try {
                String brief = sceneBriefs.get(i);
                String prompt = buildIllustrationPrompt(heading.getOriginalText(), brief);
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

                if (i < sceneBriefs.size() - 1) {
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
     * Asks GPT to identify N distinct key scenes from DIFFERENT parts of the chapter,
     * in chronological order, for sequential illustration.
     */
    private List<String> identifyKeyScenes(String chapterTitle, String excerpt, int maxScenes) {
        if (excerpt.isBlank()) return List.of();
        try {
            String raw = openAiService.complete("gpt-4.1-nano", 600,
                List.of(
                    Map.of("role", "system", "content",
                        "You are an art director choosing scenes from a book chapter to illustrate sequentially. " +
                        "The excerpt uses [...] to mark skipped passages — the chapter is longer than what is shown. " +
                        "Decide how many scenes to illustrate (1 to " + maxScenes + "): " +
                        "short/transitional chapters → 1–2; medium chapters → 2–3; long/rich chapters → 4–5. " +
                        "CRITICAL RULE: Each scene MUST come from a DIFFERENT part of the chapter. " +
                        "Spread them across the chapter arc — e.g. for 3 scenes: one from the beginning, one from the middle, one from the end. " +
                        "Do NOT pick two scenes from the same moment or the same event. " +
                        "Return them in chronological order (as they appear in the chapter). " +
                        "For each scene write a brief (max 60 words): character NAMES and appearance, setting, mood, one specific dramatic action or emotional beat. " +
                        "Return a JSON array of strings ONLY, e.g. [\"brief1\", \"brief2\"]. No other text."),
                    Map.of("role", "user", "content",
                        "Chapter: " + chapterTitle + "\n\n" +
                        excerpt.substring(0, Math.min(2000, excerpt.length())))
                )
            );

            // Parse JSON array
            String trimmed = raw.strip();
            // Strip markdown code fences if present
            if (trimmed.startsWith("```")) {
                trimmed = trimmed.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            }
            ObjectMapper mapper = new ObjectMapper();
            @SuppressWarnings("unchecked")
            List<String> scenes = mapper.readValue(trimmed, List.class);
            // Cap at maxScenes
            if (scenes.size() > maxScenes) scenes = scenes.subList(0, maxScenes);
            return scenes;
        } catch (Exception e) {
            log.warn("Key scene identification failed for '{}': {}", chapterTitle, e.getMessage());
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
