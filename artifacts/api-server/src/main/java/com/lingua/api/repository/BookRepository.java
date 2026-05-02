package com.lingua.api.repository;

import com.lingua.api.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookRepository extends JpaRepository<Book, Integer> {

    List<Book> findAllByOrderByCreatedAtAsc();

    @Query(value = "SELECT SUM(array_length(regexp_split_to_array(trim(original_text), '\\s+'), 1)) FROM paragraphs WHERE book_id = :bookId", nativeQuery = true)
    Long countWordsByBookId(Integer bookId);
}
