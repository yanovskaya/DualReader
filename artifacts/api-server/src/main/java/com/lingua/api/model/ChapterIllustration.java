package com.lingua.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "chapter_illustrations")
@Data
@NoArgsConstructor
public class ChapterIllustration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "book_id", nullable = false)
    private Integer bookId;

    @Column(name = "paragraph_id", nullable = false)
    private Integer paragraphId;

    @Column(name = "image_data", nullable = false)
    private byte[] imageData;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
