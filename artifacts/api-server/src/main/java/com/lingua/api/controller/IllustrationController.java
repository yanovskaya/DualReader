package com.lingua.api.controller;

import com.lingua.api.repository.ChapterIllustrationRepository;
import com.lingua.api.service.IllustrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class IllustrationController {

    private final IllustrationService illustrationService;
    private final ChapterIllustrationRepository illustrationRepo;

    // GET /books/:id/chapter-illustrations — list all illustration metadata for a book
    @GetMapping("/books/{id}/chapter-illustrations")
    public ResponseEntity<?> listIllustrations(@PathVariable Integer id) {
        return ResponseEntity.ok(Map.of("illustrations", illustrationService.getIllustrations(id)));
    }

    // GET /books/:bookId/chapter-illustrations/:illustrationId — serve the actual image by PK
    @GetMapping("/books/{bookId}/chapter-illustrations/{illustrationId}")
    public ResponseEntity<byte[]> getIllustration(
            @PathVariable Integer bookId,
            @PathVariable Integer illustrationId) {
        return illustrationRepo.findById(illustrationId)
                .filter(illus -> illus.getBookId().equals(bookId))
                .map(illus -> {
                    byte[] img = illus.getImageData();
                    boolean isPng  = img.length >= 4 && img[0] == (byte)0x89 && img[1] == (byte)0x50;
                    boolean isJpeg = img.length >= 2 && img[0] == (byte)0xFF && img[1] == (byte)0xD8;
                    MediaType mt = isPng ? MediaType.IMAGE_PNG
                                 : isJpeg ? MediaType.IMAGE_JPEG
                                 : MediaType.valueOf("image/svg+xml");
                    return ResponseEntity.ok()
                            .contentType(mt)
                            .header("Cache-Control", "public, max-age=86400")
                            .body(img);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /books/:id/illustration-status — generation progress
    @GetMapping("/books/{id}/illustration-status")
    public ResponseEntity<?> illustrationStatus(@PathVariable Integer id) {
        return ResponseEntity.ok(illustrationService.getProgress(id));
    }

    // POST /books/:id/generate-illustrations?force=true — trigger (re)generation; force clears existing
    @PostMapping("/books/{id}/generate-illustrations")
    public ResponseEntity<?> generateIllustrations(
            @PathVariable Integer id,
            @RequestParam(name = "force", defaultValue = "false") boolean force) {
        if (force) {
            illustrationService.forceRegenerateForBook(id);
        } else {
            illustrationService.scheduleForBook(id);
        }
        return ResponseEntity.accepted().body(Map.of("status", "generating"));
    }

    // POST /books/:id/stop-illustrations — stop active generation
    @PostMapping("/books/{id}/stop-illustrations")
    public ResponseEntity<?> stopIllustrations(@PathVariable Integer id) {
        illustrationService.stopGeneration(id);
        return ResponseEntity.ok(Map.of("status", "stopping"));
    }

    // POST /books/:id/chapters/:paragraphId/generate-illustrations
    // Generate illustrations for a single chapter (including technical ones like Chapter Notes)
    @PostMapping("/books/{id}/chapters/{paragraphId}/generate-illustrations")
    public ResponseEntity<?> generateForChapter(
            @PathVariable Integer id,
            @PathVariable Integer paragraphId) {
        illustrationService.scheduleForChapter(id, paragraphId);
        return ResponseEntity.accepted().body(Map.of("status", "generating"));
    }

}
