package com.lingua.api.controller;

import com.lingua.api.model.Book;
import com.lingua.api.model.Paragraph;
import com.lingua.api.repository.ParagraphRepository;
import com.lingua.api.service.BookService;
import com.lingua.api.service.CoverService;
import com.lingua.api.service.TranslationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;

@RestController
@RequiredArgsConstructor
public class BookController {

    private final BookService bookService;
    private final TranslationService translationService;
    private final ParagraphRepository paragraphRepo;
    private final CoverService coverService;

    // ── GET /books ─────────────────────────────────────────────────────────
    @GetMapping("/books")
    public List<Map<String, Object>> listBooks() {
        return bookService.listBooks().stream().map(this::bookToMap).toList();
    }

    // ── POST /books ────────────────────────────────────────────────────────
    @PostMapping("/books")
    public ResponseEntity<?> createBook(@RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String author = (String) body.get("author");
        String language = (String) body.get("language");
        String content = (String) body.get("content");

        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "title is required"));
        }
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "content is required"));
        }

        Book book = bookService.createBook(title, author, language, content);
        return ResponseEntity.status(201).body(bookToMap(book));
    }

    // ── GET /books/:id/cover ───────────────────────────────────────────────
    @GetMapping("/books/{id}/cover")
    public ResponseEntity<byte[]> getCover(@PathVariable Integer id) {
        return bookService.getBook(id).map(book -> {
            byte[] img = book.getCoverImage();
            if (img == null || img.length == 0) {
                // Generate SVG on-the-fly as fallback — always returns something beautiful
                byte[] svg = coverService.generateSvgCover(book.getTitle(), book.getAuthor());
                return ResponseEntity.ok()
                        .contentType(MediaType.valueOf("image/svg+xml"))
                        .body(svg);
            }
            // Detect PNG vs SVG by magic bytes
            boolean isPng = img.length >= 4 &&
                    img[0] == (byte)0x89 && img[1] == (byte)0x50 &&
                    img[2] == (byte)0x4E && img[3] == (byte)0x47;
            MediaType mt = isPng ? MediaType.IMAGE_PNG : MediaType.valueOf("image/svg+xml");
            return ResponseEntity.ok().contentType(mt).body(img);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── POST /books/:id/generate-cover ────────────────────────────────────
    @PostMapping("/books/{id}/generate-cover")
    public ResponseEntity<?> generateCover(@PathVariable Integer id) {
        return bookService.getBook(id).map(book -> {
            coverService.scheduleGeneration(book.getId(), book.getTitle(), book.getAuthor());
            return ResponseEntity.accepted().body(Map.of("status", "generating"));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── GET /books/:id ─────────────────────────────────────────────────────
    @GetMapping("/books/{id}")
    public ResponseEntity<?> getBook(@PathVariable Integer id) {
        return bookService.getBook(id)
                .map(b -> ResponseEntity.ok(bookToMap(b)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── DELETE /books/:id ──────────────────────────────────────────────────
    @DeleteMapping("/books/{id}")
    public ResponseEntity<Void> deleteBook(@PathVariable Integer id) {
        if (bookService.getBook(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        bookService.deleteBook(id);
        return ResponseEntity.noContent().build();
    }

    // ── GET /books/:id/paragraphs ──────────────────────────────────────────
    @GetMapping("/books/{id}/paragraphs")
    public ResponseEntity<?> getParagraphs(
            @PathVariable Integer id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        if (bookService.getBook(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        page = Math.max(1, page);
        pageSize = Math.min(100, Math.max(1, pageSize));
        return ResponseEntity.ok(bookService.getParagraphs(id, page, pageSize));
    }

    // ── GET /books/:id/chapters ────────────────────────────────────────────
    @GetMapping("/books/{id}/chapters")
    public ResponseEntity<?> getChapters(@PathVariable Integer id) {
        if (bookService.getBook(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("chapters", bookService.getChapters(id)));
    }

    // ── GET /books/:id/search ──────────────────────────────────────────────
    @GetMapping("/books/{id}/search")
    public ResponseEntity<?> search(
            @PathVariable Integer id,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "40") int limit) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing query parameter q"));
        }
        if (bookService.getBook(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        limit = Math.min(80, Math.max(1, limit));
        return ResponseEntity.ok(bookService.search(id, q, limit));
    }

    // ── GET /books/:id/stats ───────────────────────────────────────────────
    @GetMapping("/books/{id}/stats")
    public ResponseEntity<?> getStats(@PathVariable Integer id) {
        if (bookService.getBook(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(bookService.getStats(id));
    }

    // ── GET /books/:id/translation-status ─────────────────────────────────
    @GetMapping("/books/{id}/translation-status")
    public ResponseEntity<?> translationStatus(@PathVariable Integer id) {
        return bookService.getBook(id).map(book -> {
            int pct = book.getTotalParagraphs() > 0
                    ? Math.round((float) book.getTranslatedParagraphs() / book.getTotalParagraphs() * 100)
                    : 0;
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("bookId", book.getId());
            result.put("status", book.getTranslationStatus());
            result.put("totalParagraphs", book.getTotalParagraphs());
            result.put("translatedParagraphs", book.getTranslatedParagraphs());
            result.put("progressPercent", pct);
            return ResponseEntity.ok(result);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── POST /books/:id/translate  (SSE) ────────────────────────────────
    @PostMapping("/books/{id}/translate")
    public ResponseEntity<?> translate(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, Object> body) {
        if (bookService.getBook(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        int batchSize = 8;
        if (body != null && body.get("batchSize") != null) {
            try { batchSize = Integer.parseInt(body.get("batchSize").toString()); } catch (Exception ignored) {}
        }
        SseEmitter emitter = new SseEmitter(300_000L);
        translationService.translateBook(id, batchSize, emitter);
        return ResponseEntity.ok(emitter);
    }

    // ── GET /books/:id/progress ────────────────────────────────────────────
    @GetMapping("/books/{id}/progress")
    public ResponseEntity<?> getProgress(@PathVariable Integer id) {
        return bookService.getBook(id).map(book -> {
            Map<String, Object> result = new LinkedHashMap<>();
            Integer paraId = book.getParagraphId();
            Integer paraPosition = null;
            if (paraId != null) {
                paraPosition = paragraphRepo.findById(paraId)
                        .map(p -> p.getPosition()).orElse(null);
            }
            result.put("paragraphId", paraId);
            result.put("paragraphPosition", paraPosition);
            result.put("paragraphOffset", book.getParagraphOffset() != null ? book.getParagraphOffset() : 0.0);
            result.put("ruOffset", book.getRuOffset() != null ? book.getRuOffset() : 0.0);
            return ResponseEntity.ok(result);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── PUT /books/:id/progress ────────────────────────────────────────────
    @PutMapping("/books/{id}/progress")
    public ResponseEntity<?> saveProgress(
            @PathVariable Integer id,
            @RequestBody Map<String, Object> body) {
        if (bookService.getBook(id).isEmpty()) return ResponseEntity.notFound().build();
        Integer paragraphId = body.get("paragraphId") instanceof Number n ? n.intValue() : null;
        double paragraphOffset = body.get("paragraphOffset") instanceof Number n ? n.doubleValue() : 0.0;
        double ruOffset = body.get("ruOffset") instanceof Number n ? n.doubleValue() : 0.0;
        bookService.updateProgress(id, paragraphId, paragraphOffset, ruOffset);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ── GET /paragraphs/:id/translation ───────────────────────────────────
    @GetMapping("/paragraphs/{id}/translation")
    public ResponseEntity<?> getParagraphTranslation(@PathVariable Integer id) {
        return paragraphRepo.findById(id)
                .map(p -> ResponseEntity.ok(bookService.paragraphToMap(p)))
                .orElse(ResponseEntity.notFound().build());
    }

    private Map<String, Object> bookToMap(Book b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("title", b.getTitle());
        m.put("author", b.getAuthor());
        m.put("language", b.getLanguage());
        m.put("totalParagraphs", b.getTotalParagraphs());
        m.put("translatedParagraphs", b.getTranslatedParagraphs());
        m.put("translationStatus", b.getTranslationStatus());
        m.put("createdAt", b.getCreatedAt().toString());
        return m;
    }
}
