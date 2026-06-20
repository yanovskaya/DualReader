package com.lingua.api.repository;

import com.lingua.api.model.ChapterIllustration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChapterIllustrationRepository extends JpaRepository<ChapterIllustration, Integer> {

    List<ChapterIllustration> findByBookIdOrderByParagraphId(Integer bookId);

    Optional<ChapterIllustration> findByBookIdAndParagraphId(Integer bookId, Integer paragraphId);

    boolean existsByBookIdAndParagraphId(Integer bookId, Integer paragraphId);
}
