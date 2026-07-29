package com.lingua.api.repository;

import com.lingua.api.model.ChapterIllustration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChapterIllustrationRepository extends JpaRepository<ChapterIllustration, Integer> {

    // Metadata-only — excludes imageData blob to prevent OOM when listing
    // Returns rows ordered by paragraphId, then sceneIndex
    @Query("SELECT c.id, c.paragraphId, c.sceneIndex FROM ChapterIllustration c WHERE c.bookId = :bookId ORDER BY c.paragraphId ASC, c.sceneIndex ASC")
    List<Object[]> findMetadataByBookId(@Param("bookId") Integer bookId);

    // Distinct paragraph IDs that have at least one illustration (for TOC map)
    @Query("SELECT DISTINCT c.paragraphId FROM ChapterIllustration c WHERE c.bookId = :bookId ORDER BY c.paragraphId")
    List<Integer> findParagraphIdsByBookId(@Param("bookId") Integer bookId);

    List<ChapterIllustration> findByBookIdAndParagraphIdOrderBySceneIndexAsc(Integer bookId, Integer paragraphId);

    boolean existsByBookIdAndParagraphId(Integer bookId, Integer paragraphId);

    long countByBookIdAndParagraphId(Integer bookId, Integer paragraphId);

    long countByBookId(Integer bookId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM ChapterIllustration c WHERE c.bookId = :bookId")
    void deleteByBookId(@Param("bookId") Integer bookId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM ChapterIllustration c WHERE c.bookId = :bookId AND c.paragraphId = :paragraphId")
    void deleteByBookIdAndParagraphId(@Param("bookId") Integer bookId, @Param("paragraphId") Integer paragraphId);
}
