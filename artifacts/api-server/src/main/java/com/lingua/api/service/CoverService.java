package com.lingua.api.service;

import com.lingua.api.repository.BookRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CoverService {

    private static final Logger log = LoggerFactory.getLogger(CoverService.class);
    private static final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final ObjectMapper mapper = new ObjectMapper();

    private final BookRepository bookRepo;
    private final OpenAiService openAiService;

    // 12 rich, dark gradient palettes (SVG fallback)
    private static final String[][] PALETTES = {
        {"#1a1a2e", "#0f3460", "#e8d5b7", "#e8b86d"},
        {"#3d1a24", "#8b3a52", "#fde8d0", "#e8a87c"},
        {"#0f2027", "#2c5364", "#d8f3f0", "#7fd0c8"},
        {"#1a0a2e", "#5c2a9b", "#efe0ff", "#c89aff"},
        {"#0d3b2e", "#2d7a52", "#d8f5e8", "#7ecfa0"},
        {"#2a1500", "#6b3800", "#fdf0d5", "#e8c060"},
        {"#1a0a0a", "#6b1a1a", "#ffe8e8", "#ff9898"},
        {"#0a1628", "#2c4a8a", "#d8e8ff", "#80b0f8"},
        {"#1a1200", "#6b4800", "#fdf5d8", "#e0c050"},
        {"#0a1a0a", "#2a5c2a", "#e8fce8", "#88d888"},
        {"#0d0d1a", "#2a2a6b", "#e8e8ff", "#a8a8ff"},
        {"#1a0d15", "#6b2a52", "#ffe8f5", "#f080c0"},
    };

    // AO3 / fanfic metadata line prefixes to skip when building excerpt
    private static final String[] METADATA_PREFIXES = {
        "rating:", "archive warning:", "category:", "fandom:", "relationship:",
        "characters:", "additional tags:", "language:", "stats:", "words:",
        "kudos:", "bookmarks:", "hits:", "chapters:", "series:", "collections:",
        "published:", "updated:", "summary:", "end notes:", "author's note:",
        "posted originally on", "originally posted", "a/n:", "note:",
        "disclaimer:", "warnings:", "pairing:", "status:",
        // Author's notes / community messages
        "hi everyone", "hello everyone", "hey everyone", "hi all", "hello all",
        "hi guys", "hello guys", "hey guys", "hi there", "hello there",
        "welcome to", "welcome back", "so this is", "this is my",
        "this is a new", "this is the", "this story", "this fic", "this fanfic",
        "thank you for reading", "thanks for reading", "please review",
        "please comment", "please leave a review", "don't forget to",
        "i do not own", "i don't own", "i own nothing", "no copyright",
        "this was", "this chapter", "this is just",
        "as always", "as usual", "once again"
    };

    private static final String[] METADATA_CONTAINS = {
        "fanfiction.net", "ao3.org", "archiveofourown", "ffnet", "ff.net",
        "follow/favorite", "follow / favorite", "leave a review"
    };

    /**
     * Schedules async generation of description + AI cover image for a newly uploaded book.
     * Receives many paragraphs so it can skip metadata and find actual prose.
     */
    public void scheduleGeneration(Integer bookId, String title, String author, List<String> paragraphs) {
        executor.submit(() -> {
            try {
                // Filter to prose-only paragraphs, then build excerpt
                List<String> prose = filterProse(paragraphs);
                log.info("Book {}: {} total paragraphs, {} prose paragraphs", bookId, paragraphs.size(), prose.size());
                String excerpt = buildExcerpt(prose.isEmpty() ? paragraphs : prose, 1500);

                // 1. Generate Russian description (for UI display on book cards)
                String description = generateDescription(title, author, excerpt);

                // 2. Extract visual scene brief from excerpt (for image generation)
                //    — describes setting, character appearances, mood without proper names
                String visualBrief = extractVisualBrief(excerpt);

                // 3. Generate AI image cover (gpt-image-1)
                byte[] coverBytes = generateCoverImage(title, author, description, visualBrief);

                // 3. Fall back to SVG if image generation failed
                if (coverBytes == null) {
                    log.warn("gpt-image-1 failed for book {}, using SVG fallback", bookId);
                    coverBytes = generateSvgCover(title, author);
                }

                final byte[] finalCover = coverBytes;
                bookRepo.findById(bookId).ifPresent(book -> {
                    if (description != null && !description.isBlank()) {
                        book.setDescription(description);
                    }
                    book.setCoverImage(finalCover);
                    bookRepo.save(book);
                    boolean savedPng  = finalCover[0] == (byte)0x89 && finalCover[1] == (byte)0x50;
                    boolean savedJpeg = finalCover[0] == (byte)0xFF && finalCover[1] == (byte)0xD8;
                    log.info("Description + cover saved for book {} ({})",
                            bookId, savedPng ? "PNG" : savedJpeg ? "JPEG" : "SVG");
                });

            } catch (Exception e) {
                log.warn("Cover/description generation failed for book {}: {}", bookId, e.getMessage());
            }
        });
    }

    /** Backward-compatible overload for cases without paragraphs. */
    public void scheduleGeneration(Integer bookId, String title, String author) {
        scheduleGeneration(bookId, title, author, List.of());
    }

    // ── Prose filtering ───────────────────────────────────────────────────────

    /**
     * Filters out AO3/fanfic metadata lines, leaving only actual prose paragraphs.
     */
    private static List<String> filterProse(List<String> paragraphs) {
        return paragraphs.stream()
                .filter(CoverService::isProse)
                .collect(Collectors.toList());
    }

    private static boolean isProse(String p) {
        if (p == null || p.isBlank()) return false;
        String trimmed = p.trim();

        // Skip very short lines — metadata headers are usually brief
        if (trimmed.length() < 60) return false;

        String lower = trimmed.toLowerCase();

        // Skip known AO3/fanfic metadata prefixes
        for (String prefix : METADATA_PREFIXES) {
            if (lower.startsWith(prefix)) return false;
        }

        // Skip lines containing URLs
        if (trimmed.contains("http://") || trimmed.contains("https://")) return false;

        // Skip lines that look like "Key: value" (colon within first 25 chars)
        int colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0 && colonIdx < 25) return false;

        // Skip lines containing fanfic community keywords anywhere
        for (String kw : METADATA_CONTAINS) {
            if (lower.contains(kw)) return false;
        }

        return true;
    }

    // ── Description generation ────────────────────────────────────────────────

    /**
     * Uses OpenAI chat to write a 1-2 sentence Russian description of the book.
     */
    private String generateDescription(String title, String author, String excerpt) {
        try {
            if (excerpt == null || excerpt.isBlank()) {
                log.warn("Empty excerpt for '{}', skipping description", title);
                return null;
            }
            log.info("Generating description for '{}' (excerpt {} chars)", title, excerpt.length());
            String userMsg = String.format(
                "Книга: \"%s\"%s\n\nНачало текста:\n%s\n\n" +
                "Напиши краткое описание книги на русском языке — 1-2 предложения, " +
                "передающих суть и атмосферу. Только описание, без лишних слов.",
                title,
                author != null && !author.isBlank() ? " — " + author : "",
                excerpt
            );
            String result = openAiService.complete("gpt-4.1-mini", 250,
                List.of(
                    Map.of("role", "system", "content",
                        "Ты литературный редактор. Пишешь краткие, атмосферные аннотации к книгам на русском языке."),
                    Map.of("role", "user", "content", userMsg)
                )
            );
            log.info("Description result for '{}': {} chars", title,
                    result == null ? -1 : result.length());
            return result == null || result.isBlank() ? null : result.strip();
        } catch (Exception e) {
            log.warn("Description generation failed for '{}': {}", title, e.getMessage());
            return null;
        }
    }

    // ── Visual scene brief extraction ────────────────────────────────────────

    /**
     * Asks gpt-4.1-mini to extract a visual scene brief from the excerpt:
     * setting, character appearances (no proper names), and atmosphere.
     * Result is used as the image generation prompt — safe for gpt-image-1 moderation.
     */
    private String extractVisualBrief(String excerpt) {
        if (excerpt == null || excerpt.isBlank()) return null;
        try {
            String userMsg =
                "From this book excerpt, describe the visual scene for a cover illustration.\n" +
                "Return a single dense paragraph in English with:\n" +
                "- the location/setting described in GENERIC terms (e.g. 'ancient stone castle corridor', " +
                "'dimly lit bedroom', 'moonlit courtyard') — NO franchise names, NO IP names\n" +
                "- physical appearance of each main character (hair color, build, clothing, expression) — " +
                "NO character names\n" +
                "- the emotional atmosphere and mood\n" +
                "CRITICAL: Never mention any franchise, brand, or IP names " +
                "(e.g. replace 'Hogwarts' with 'ancient magic school', 'thestral' with 'skeletal winged horse', " +
                "'wand' with 'magic staff'). Max 60 words.\n\n" +
                "Excerpt:\n" + excerpt;

            String result = openAiService.complete("gpt-4.1-mini", 150,
                List.of(
                    Map.of("role", "system", "content",
                        "You are an art director writing image generation prompts. " +
                        "Describe only visual, paintable details. Never use character names, " +
                        "franchise names, or any copyrighted IP names."),
                    Map.of("role", "user", "content", userMsg)
                )
            );
            log.info("Visual brief for excerpt: {}", result == null ? "null" :
                    result.substring(0, Math.min(100, result.length())));
            return result == null || result.isBlank() ? null : result.strip();
        } catch (Exception e) {
            log.warn("Visual brief extraction failed: {}", e.getMessage());
            return null;
        }
    }

    // ── Cover image generation via gpt-image-1 ───────────────────────────────

    /**
     * Generates a portrait cover illustration using gpt-image-1 (1024x1536).
     * Returns raw PNG bytes, or null if generation fails.
     */
    private byte[] generateCoverImage(String title, String author, String description, String excerpt) {
        try {
            String prompt = buildCoverPrompt(title, author, description, excerpt);
            log.info("gpt-image-1 prompt for '{}': {}…", title, prompt.substring(0, Math.min(120, prompt.length())));
            byte[] bytes = openAiService.imageGenerate(prompt, "1024x1536");
            log.info("gpt-image-1 image received: {} KB", bytes.length / 1024);
            return bytes;
        } catch (Exception e) {
            log.warn("gpt-image-1 generation failed for '{}': {}", title, e.getMessage());
            return null;
        }
    }

    /** Builds a safe, scene-specific illustration prompt for gpt-image-1.
     *  Uses visual brief (setting + character appearances) for scene accuracy,
     *  falls back to Russian description, then generic atmosphere. */
    private String buildCoverPrompt(String title, String author, String description, String visualBrief) {
        String style =
            "Style: professional digital painting, book cover illustration art, " +
            "vibrant rich colors, sharp crisp detail, clean composition, " +
            "soft luminous lighting, painterly brushwork with clean edges, " +
            "highly detailed faces and setting, cinematic atmosphere. " +
            "Portrait orientation. No text, no words, no letters, no titles, no watermarks.";

        // Best: visual brief extracted from actual book content (specific scene, no names)
        if (visualBrief != null && !visualBrief.isBlank()) {
            return String.format("Book cover illustration. %s. %s", visualBrief.strip(), style);
        }

        // Good: Russian description captures mood and theme
        if (description != null && !description.isBlank()) {
            return String.format("Book cover illustration. %s. %s", description.strip(), style);
        }

        // Last resort: generic romantic drama
        return String.format(
            "Book cover illustration. Two young people in a dramatic emotional moment, " +
            "tension and longing between them, moody elegant atmosphere, " +
            "rich jewel-toned colors, soft candlelight. %s",
            style
        );
    }

    // ── SVG fallback cover ────────────────────────────────────────────────────

    public byte[] generateSvgCover(String title, String author) {
        String[] palette = PALETTES[Math.abs(hashStr(title)) % PALETTES.length];
        String top    = palette[0];
        String bot    = palette[1];
        String text   = palette[2];
        String accent = palette[3];

        String[] titleLines = wrapText(title, 18);
        double titleY = author != null && !author.isBlank() ? 310.0 : 330.0;

        StringBuilder titleSvg = new StringBuilder();
        for (int i = 0; i < titleLines.length; i++) {
            titleSvg.append(String.format(
                "<text x=\"200\" y=\"%.0f\" text-anchor=\"middle\" " +
                "font-family=\"Georgia,serif\" font-size=\"26\" font-weight=\"bold\" fill=\"%s\" " +
                "letter-spacing=\"0.5\">%s</text>",
                titleY + i * 34, text, xmlEscape(titleLines[i])));
        }

        String authorSvg = "";
        if (author != null && !author.isBlank()) {
            authorSvg = String.format(
                "<text x=\"200\" y=\"%.0f\" text-anchor=\"middle\" " +
                "font-family=\"Arial,sans-serif\" font-size=\"14\" fill=\"%s\" " +
                "letter-spacing=\"2\">%s</text>",
                titleY + titleLines.length * 34 + 16, accent, xmlEscape(author.toUpperCase()));
        }

        String svg = String.format("""
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
                  <stop offset="0" stop-color="%s"/>
                  <stop offset="1" stop-color="%s"/>
                </linearGradient>
                <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="rgba(255,255,255,0.07)"/>
                  <stop offset="1" stop-color="rgba(255,255,255,0)"/>
                </linearGradient>
              </defs>
              <rect width="400" height="600" fill="url(#bg)"/>
              <rect width="400" height="600" fill="url(#shine)"/>
              <rect width="12" height="600" fill="rgba(0,0,0,0.35)"/>
              <line x1="120" y1="150" x2="280" y2="150" stroke="%s" stroke-width="1" opacity="0.6"/>
              <circle cx="200" cy="200" r="4" fill="%s" opacity="0.9"/>
              <circle cx="200" cy="200" r="16" stroke="%s" stroke-width="1" fill="none" opacity="0.7"/>
              <circle cx="200" cy="200" r="30" stroke="%s" stroke-width="0.6" fill="none" opacity="0.45" stroke-dasharray="4 4"/>
              <line x1="200" y1="168" x2="200" y2="160" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="200" y1="232" x2="200" y2="240" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="168" y1="200" x2="160" y2="200" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="232" y1="200" x2="240" y2="200" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="120" y1="250" x2="280" y2="250" stroke="%s" stroke-width="1" opacity="0.6"/>
              %s
              %s
            </svg>""",
            top, bot,
            accent,
            accent, accent, accent,
            accent, accent, accent, accent,
            accent,
            titleSvg, authorSvg);

        return svg.getBytes(StandardCharsets.UTF_8);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String buildExcerpt(List<String> paragraphs, int maxChars) {
        StringBuilder sb = new StringBuilder();
        for (String p : paragraphs) {
            if (sb.length() + p.length() > maxChars) break;
            sb.append(p).append("\n\n");
        }
        return sb.toString().strip();
    }

    private static int hashStr(String s) {
        int h = 0;
        for (char c : s.toCharArray()) h = 31 * h + c;
        return h;
    }

    private static String xmlEscape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static String[] wrapText(String text, int maxLen) {
        if (text.length() <= maxLen) return new String[]{text};
        String[] words = text.split(" ");
        StringBuilder line1 = new StringBuilder();
        StringBuilder line2 = new StringBuilder();
        boolean onLine2 = false;
        for (String w : words) {
            if (!onLine2 && (line1.length() == 0 || line1.length() + 1 + w.length() <= maxLen)) {
                if (line1.length() > 0) line1.append(' ');
                line1.append(w);
            } else {
                onLine2 = true;
                if (line2.length() > 0) line2.append(' ');
                line2.append(w);
            }
        }
        if (line2.length() == 0) return new String[]{line1.toString()};
        String l2 = line2.toString();
        if (l2.length() > maxLen) l2 = l2.substring(0, maxLen - 1) + "…";
        return new String[]{line1.toString(), l2};
    }
}
