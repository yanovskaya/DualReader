package com.lingua.api.repository;

import com.lingua.api.model.Paragraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ParagraphRepository extends JpaRepository<Paragraph, Integer> {

    long countByBookId(Integer bookId);

    Page<Paragraph> findByBookIdOrderByPosition(Integer bookId, Pageable pageable);

    List<Paragraph> findByBookIdOrderByPosition(Integer bookId);

    List<Paragraph> findByBookIdAndIsTranslatedFalseOrderByPosition(Integer bookId);

    @Query("SELECT p FROM Paragraph p WHERE p.bookId = :bookId AND " +
           "LOWER(p.originalText) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "ORDER BY p.position")
    List<Paragraph> searchByBookId(Integer bookId, String q, Pageable pageable);
}
