package com.lingua.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "books")
@Data
@NoArgsConstructor
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String title;

    private String author;

    @Column(nullable = false)
    private String language = "en";

    @Column(name = "total_paragraphs", nullable = false)
    private int totalParagraphs = 0;

    @Column(name = "translated_paragraphs", nullable = false)
    private int translatedParagraphs = 0;

    @Column(name = "translation_status", columnDefinition = "translation_status")
    private String translationStatus = "pending";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
