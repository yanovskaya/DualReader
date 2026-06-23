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
    @Query("SELECT c.paragraphId FROM ChapterIllustration c WHERE c.bookId = :bookId ORDER BY c.paragraphId")
    List<Integer> findParagraphIdsByBookId(@Param("bookId") Integer bookId);

    Optional<ChapterIllustration> findByBookIdAndParagraphId(Integer bookId, Integer paragraphId);

    boolean existsByBookIdAndParagraphId(Integer bookId, Integer paragraphId);

    void deleteByBookId(Integer bookId);
}
