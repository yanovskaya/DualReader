package com.lingua.api.controller;

import com.lingua.api.service.DictionaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/dictionary")
@RequiredArgsConstructor
public class DictionaryController {

    private final DictionaryService dictionaryService;

    // GET /dictionary/lookup?word=...&context=...
    @GetMapping("/lookup")
    public ResponseEntity<?> lookup(
            @RequestParam(required = false) String word,
            @RequestParam(required = false) String context) {
        if (word == null || word.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required parameter: word"));
        }
        try {
            return ResponseEntity.ok(dictionaryService.lookup(word, context));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Dictionary lookup failed"));
        }
    }

    // GET /dictionary/recent
    @GetMapping("/recent")
    public ResponseEntity<List<Map<String, Object>>> recent() {
        return ResponseEntity.ok(dictionaryService.recent());
    }
}
