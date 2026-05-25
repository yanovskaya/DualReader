package com.lingua.api.service;

import com.lingua.api.repository.BookRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@RequiredArgsConstructor
public class CoverService {

    private static final Logger log = LoggerFactory.getLogger(CoverService.class);
    private static final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final ObjectMapper mapper = new ObjectMapper();

    private final BookRepository bookRepo;
    private final OpenAiService openAiService;

    // Shared HTTP client (reused across calls)
    private static final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .build();

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

    /**
     * Schedules async generation of description + AI cover image for a newly uploaded book.
     * Receives the first few paragraphs so it can call AI without a separate DB read.
     */
    public void scheduleGeneration(Integer bookId, String title, String author, List<String> firstParagraphs) {
        executor.submit(() -> {
            try {
                String excerpt = buildExcerpt(firstParagraphs, 1500);

                // 1. Generate Russian description from actual book text
                String description = generateDescription(title, author, excerpt);

                // 2. Generate AI image cover (Pollinations.ai — no key required)
                byte[] coverBytes = generatePollinationsImage(title, author, description, excerpt);

                // 3. Fall back to SVG if image generation failed
                if (coverBytes == null) {
                    log.warn("Pollinations failed for book {}, using SVG fallback", bookId);
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

    // ── Description generation ────────────────────────────────────────────────

    /**
     * Uses OpenAI chat to write a 1-2 sentence Russian description of the book.
     */
    private String generateDescription(String title, String author, String excerpt) {
        try {
            log.info("Generating description for '{}' (excerpt {} chars)", title, excerpt == null ? 0 : excerpt.length());
            String userMsg = String.format(
                "Книга: \"%s\"%s\n\nНачало текста:\n%s\n\n" +
                "Напиши краткое описание книги на русском языке — 1-2 предложения, " +
                "передающих суть и атмосферу. Только описание, без лишних слов.",
                title,
                author != null && !author.isBlank() ? " — " + author : "",
                excerpt
            );

            String result = openAiService.complete("gpt-5-nano", 200,
                List.of(
                    Map.of("role", "system", "content",
                        "Ты литературный редактор. Пишешь краткие, атмосферные аннотации к книгам на русском языке."),
                    Map.of("role", "user", "content", userMsg)
                )
            );
            log.info("Description result for '{}': {} chars, blank={}", title, result == null ? -1 : result.length(), result == null || result.isBlank());
            return result == null ? null : result.strip();
        } catch (Exception e) {
            log.warn("Description generation failed for '{}': {}", title, e.getMessage());
            return null;
        }
    }

    // ── Cover image generation via Pollinations.ai ────────────────────────────

    /**
     * Generates an AI book cover illustration using Pollinations.ai (no API key needed).
     * Returns image bytes (PNG or JPEG), or null if the request fails.
     */
    private byte[] generatePollinationsImage(String title, String author, String description, String excerpt) {
        try {
            String visualPrompt = buildCoverPrompt(title, author, description, excerpt);
            log.info("Generating Pollinations cover for '{}': {}", title, visualPrompt);

            String encoded = URLEncoder.encode(visualPrompt, StandardCharsets.UTF_8);
            // Use &format=jpeg for reliable binary response; Pollinations Flux supports it
            String url = "https://image.pollinations.ai/prompt/" + encoded
                    + "?width=512&height=768&nologo=true&model=flux&format=jpeg&seed="
                    + Math.abs(title.hashCode());

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(90))
                    .GET()
                    .build();

            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());

            if (resp.statusCode() == 200) {
                byte[] bytes = resp.body();
                // Accept PNG (0x89 0x50) or JPEG (0xFF 0xD8)
                boolean isPng  = bytes.length >= 4 && bytes[0] == (byte)0x89 && bytes[1] == (byte)0x50;
                boolean isJpeg = bytes.length >= 2 && bytes[0] == (byte)0xFF && bytes[1] == (byte)0xD8;
                if (isPng || isJpeg) {
                    log.info("Pollinations image received: {} KB ({})", bytes.length / 1024, isPng ? "PNG" : "JPEG");
                    return bytes;
                }
                log.warn("Pollinations returned unrecognised format ({} bytes, first byte: 0x{:02X})",
                        bytes.length, bytes.length > 0 ? bytes[0] & 0xFF : 0);
            } else {
                log.warn("Pollinations returned HTTP {}", resp.statusCode());
            }
        } catch (Exception e) {
            log.warn("Pollinations image generation failed: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Builds a reliable illustration prompt from the book's content.
     * No extra AI call — uses description and excerpt directly (Flux understands Russian).
     */
    private String buildCoverPrompt(String title, String author, String description, String excerpt) {
        // Prefer the AI-generated description; fall back to first 300 chars of excerpt
        String context = null;
        if (description != null && !description.isBlank()) {
            context = description.strip();
        } else if (excerpt != null && !excerpt.isBlank()) {
            context = excerpt.length() > 300 ? excerpt.substring(0, 300).strip() + "…" : excerpt.strip();
        }

        String authorPart = (author != null && !author.isBlank()) ? " by " + author : "";

        String prompt;
        if (context != null) {
            // Flux model understands Russian; embed the description directly
            prompt = String.format(
                "Cinematic book cover illustration. Book: \"%s\"%s. Story: %s. " +
                "Highly detailed painterly digital art, professional book cover, " +
                "dramatic atmospheric lighting, rich environment, no text, no letters, no words",
                title, authorPart, context
            );
        } else {
            prompt = String.format(
                "Cinematic book cover illustration for \"%s\"%s, " +
                "dramatic atmospheric lighting, rich detailed environment, " +
                "painterly digital art, highly detailed, professional book cover, " +
                "no text, no letters, no words",
                title, authorPart
            );
        }

        log.info("Cover prompt for '{}': {}", title, prompt.length() > 120 ? prompt.substring(0, 120) + "…" : prompt);
        return prompt;
    }

    // ── SVG fallback cover ────────────────────────────────────────────────────

    /**
     * Generates a beautiful SVG cover from the book title hash. Always succeeds.
     */
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
