package com.lingua.api.service;

import com.lingua.api.repository.BookRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Generates book cover art.
 *
 * Strategy:
 *  1. Try to call an AI image generation API (if credentials allow).
 *  2. If unavailable, fall back to a deterministic SVG cover generated from the
 *     book title hash — looks beautiful and needs no external service.
 */
@Service
@RequiredArgsConstructor
public class CoverService {

    private static final Logger log = LoggerFactory.getLogger(CoverService.class);
    private static final ExecutorService executor = Executors.newFixedThreadPool(2);

    private final BookRepository bookRepo;

    // 12 rich, dark gradient palettes — consistent with the frontend component
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
     * Returns a cover image (PNG bytes if AI-generated, SVG bytes otherwise)
     * for the given book. Schedules async AI generation but always returns the
     * SVG cover immediately (via the GET /books/:id/cover endpoint logic).
     *
     * For scheduled async generation, see {@link #scheduleGeneration}.
     */
    public byte[] generateSvgCover(String title, String author) {
        String[] palette = PALETTES[Math.abs(hashStr(title)) % PALETTES.length];
        String top    = palette[0];
        String bot    = palette[1];
        String text   = palette[2];
        String accent = palette[3];

        String escapedTitle  = xmlEscape(title);
        String escapedAuthor = author != null ? xmlEscape(author) : null;

        // Wrap title into at most 2 lines of ~18 chars each
        String[] titleLines = wrapText(title, 18);
        double titleY = escapedAuthor != null ? 310.0 : 330.0;

        StringBuilder titleSvg = new StringBuilder();
        for (int i = 0; i < titleLines.length; i++) {
            titleSvg.append(String.format(
                "<text x=\"200\" y=\"%.0f\" text-anchor=\"middle\" " +
                "font-family=\"Georgia,serif\" font-size=\"26\" font-weight=\"bold\" fill=\"%s\" " +
                "letter-spacing=\"0.5\">%s</text>",
                titleY + i * 34, text, xmlEscape(titleLines[i])));
        }

        String authorSvg = "";
        if (escapedAuthor != null) {
            authorSvg = String.format(
                "<text x=\"200\" y=\"%.0f\" text-anchor=\"middle\" " +
                "font-family=\"Arial,sans-serif\" font-size=\"14\" fill=\"%s\" " +
                "letter-spacing=\"2\">%s</text>",
                titleY + titleLines.length * 34 + 16, accent, escapedAuthor.toUpperCase());
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
              <!-- Background -->
              <rect width="400" height="600" fill="url(#bg)"/>
              <rect width="400" height="600" fill="url(#shine)"/>
              <!-- Spine shadow -->
              <rect width="12" height="600" fill="rgba(0,0,0,0.35)"/>
              <!-- Top rule -->
              <line x1="120" y1="150" x2="280" y2="150" stroke="%s" stroke-width="1" opacity="0.6"/>
              <!-- Ornament -->
              <circle cx="200" cy="200" r="4" fill="%s" opacity="0.9"/>
              <circle cx="200" cy="200" r="16" stroke="%s" stroke-width="1" fill="none" opacity="0.7"/>
              <circle cx="200" cy="200" r="30" stroke="%s" stroke-width="0.6" fill="none" opacity="0.45" stroke-dasharray="4 4"/>
              <line x1="200" y1="168" x2="200" y2="160" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="200" y1="232" x2="200" y2="240" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="168" y1="200" x2="160" y2="200" stroke="%s" stroke-width="1" opacity="0.7"/>
              <line x1="232" y1="200" x2="240" y2="200" stroke="%s" stroke-width="1" opacity="0.7"/>
              <!-- Bottom rule -->
              <line x1="120" y1="250" x2="280" y2="250" stroke="%s" stroke-width="1" opacity="0.6"/>
              <!-- Title & author -->
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

    /**
     * Schedules async cover generation. Currently generates SVG synchronously
     * and stores it, as AI image generation is not available in this environment.
     */
    public void scheduleGeneration(Integer bookId, String title, String author) {
        executor.submit(() -> {
            try {
                byte[] svgBytes = generateSvgCover(title, author);
                bookRepo.findById(bookId).ifPresent(book -> {
                    if (book.getCoverImage() == null || book.getCoverImage().length == 0) {
                        book.setCoverImage(svgBytes);
                        bookRepo.save(book);
                        log.info("SVG cover generated for book {}", bookId);
                    }
                });
            } catch (Exception e) {
                log.warn("Cover generation failed for book {}: {}", bookId, e.getMessage());
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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
        // Truncate line2 if too long
        String l2 = line2.toString();
        if (l2.length() > maxLen) l2 = l2.substring(0, maxLen - 1) + "…";
        return new String[]{line1.toString(), l2};
    }
}
