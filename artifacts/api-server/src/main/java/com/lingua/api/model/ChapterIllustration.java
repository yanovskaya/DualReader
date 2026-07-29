package com.lingua.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "chapter_illustrations", uniqueConstraints = {
    @UniqueConstraint(name = "chapter_illustrations_book_id_paragraph_id_scene_key",
                      columnNames = {"book_id", "paragraph_id", "scene_index"})
})
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

    /** 0-based index within the chapter (0 = first scene, 1 = second scene, …) */
    @Column(name = "scene_index", nullable = false)
    private int sceneIndex = 0;

    @Column(name = "image_data", nullable = false)
    private byte[] imageData;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
