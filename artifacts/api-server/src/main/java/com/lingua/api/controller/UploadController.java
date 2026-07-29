package com.lingua.api.controller;

import com.lingua.api.model.Book;
import com.lingua.api.service.BookService;
import com.lingua.api.service.CoverService;
import com.lingua.api.service.EpubParser;
import com.lingua.api.service.IllustrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class UploadController {

    private final BookService bookService;
    private final CoverService coverService;
    private final EpubParser epubParser;
    private final IllustrationService illustrationService;

    // POST /books/upload
    @PostMapping("/books/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String customTitle,
            @RequestParam(value = "author", required = false) String customAuthor,
            @RequestParam(value = "convertToAmerican", required = false, defaultValue = "false") boolean convertToAmerican) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String detectedTitle = customTitle != null && !customTitle.isBlank()
                ? customTitle.trim()
                : originalName.replaceAll("(?i)\\.(txt|epub)$", "").replace("-", " ").replace("_", " ");

        try {
            byte[] bytes = file.getBytes();
            String content;

            boolean isEpub = originalName.toLowerCase().endsWith(".epub")
                    || "application/epub+zip".equals(file.getContentType());

            if (isEpub) {
                EpubParser.EpubResult parsed = epubParser.parse(bytes);
                content = parsed.content();
                if (customTitle == null || customTitle.isBlank()) {
                    detectedTitle = parsed.title();
                }
            } else {
                content = new String(bytes);
            }

            List<String> paragraphs = epubParser.splitIntoParagraphs(content);
            if (paragraphs.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Could not extract readable text from the file"));
            }

            String author = customAuthor != null && !customAuthor.isBlank() ? customAuthor.trim() : null;
            Book book = bookService.createBookFromParagraphs(detectedTitle, author, paragraphs, convertToAmerican);

            // Generate description + cover art asynchronously — doesn't block the response
            // Pass first 100 paragraphs so AI can skip past metadata headers and find prose
            List<String> excerpt = paragraphs.subList(0, Math.min(100, paragraphs.size()));
            coverService.scheduleGeneration(book.getId(), book.getTitle(), book.getAuthor(), excerpt);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", book.getId());
            m.put("title", book.getTitle());
            m.put("author", book.getAuthor());
            m.put("language", book.getLanguage());
            m.put("totalParagraphs", book.getTotalParagraphs());
            m.put("translatedParagraphs", 0);
            m.put("translationStatus", book.getTranslationStatus());
            m.put("createdAt", book.getCreatedAt().toString());
            return ResponseEntity.status(201).body(m);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to process file"));
        }
    }
}
