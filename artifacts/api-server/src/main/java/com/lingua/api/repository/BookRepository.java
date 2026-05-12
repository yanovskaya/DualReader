package com.lingua.api.repository;

import com.lingua.api.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookRepository extends JpaRepository<Book, Integer> {

    List<Book> findAllByUserIdOrderByCreatedAtAsc(String userId);

    Optional<Book> findByIdAndUserId(Integer id, String userId);

    @Query(value = "SELECT SUM(array_length(regexp_split_to_array(trim(original_text), '\\s+'), 1)) FROM paragraphs WHERE book_id = :bookId", nativeQuery = true)
    Long countWordsByBookId(Integer bookId);

    @Modifying
    @Query(value = "UPDATE books SET scroll_ratio = :scrollRatio, last_batch = :lastBatch, ru_offset = :ruOffset WHERE id = :id", nativeQuery = true)
    void updateProgress(@Param("id") Integer id,
                        @Param("scrollRatio") Double scrollRatio,
                        @Param("lastBatch") Integer lastBatch,
                        @Param("ruOffset") Double ruOffset);
}
