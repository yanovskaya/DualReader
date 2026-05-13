package com.lingua.api.service;

import com.lingua.api.model.Book;
import com.lingua.api.model.Paragraph;
import com.lingua.api.repository.BookRepository;
import com.lingua.api.repository.ParagraphRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class BookService {

    private final BookRepository bookRepo;
    private final ParagraphRepository paragraphRepo;

    public List<Book> listBooks() {
        return bookRepo.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    }

    public Optional<Book> getBook(Integer id) {
        return bookRepo.findById(id);
    }

    @Transactional
    public Book createBook(String title, String author, String language, String content) {
        List<String> rawParagraphs = Arrays.stream(content.split("\n\n+"))
                .map(String::trim)
                .filter(p -> p.length() > 10)
                .toList();

        Book book = new Book();
        book.setUserId("default");
        book.setTitle(title);
        book.setAuthor(author);
        book.setLanguage(language != null ? language : "en");
        book.setTotalParagraphs(rawParagraphs.size());
        book.setTranslatedParagraphs(0);
        book.setTranslationStatus("pending");
        bookRepo.save(book);

        insertParagraphBatch(book.getId(), rawParagraphs);
        return book;
    }

    @Transactional
    public Book createBookFromParagraphs(String title, String author, List<String> paragraphTexts) {
        Book book = new Book();
        book.setUserId("default");
        book.setTitle(title);
        book.setAuthor(author);
        book.setLanguage("en");
        book.setTotalParagraphs(paragraphTexts.size());
        book.setTranslatedParagraphs(0);
        book.setTranslationStatus("pending");
        bookRepo.save(book);

        insertParagraphBatch(book.getId(), paragraphTexts);
        return book;
    }

    private void insertParagraphBatch(Integer bookId, List<String> texts) {
        List<Paragraph> batch = new ArrayList<>();
        for (int i = 0; i < texts.size(); i++) {
            Paragraph p = new Paragraph();
            p.setBookId(bookId);
            p.setPosition(i);
            p.setOriginalText(texts.get(i));
            p.setTranslated(false);
            batch.add(p);
            if (batch.size() == 200) {
                paragraphRepo.saveAll(batch);
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            paragraphRepo.saveAll(batch);
        }
    }

    @Transactional
    public void updateProgress(Integer bookId, Integer paragraphId, Double paragraphOffset, Double ruOffset) {
        bookRepo.updateProgress(bookId, paragraphId, paragraphOffset, ruOffset);
    }

    @Transactional
    public void deleteBook(Integer id) {
        bookRepo.deleteById(id);
    }

    public Map<String, Object> getParagraphs(Integer bookId, int page, int pageSize) {
        long total = paragraphRepo.countByBookId(bookId);
        PageRequest pr = PageRequest.of(page - 1, pageSize);
        Page<Paragraph> pageResult = paragraphRepo.findByBookIdOrderByPosition(bookId, pr);

        List<Map<String, Object>> items = pageResult.getContent().stream()
                .map(this::paragraphToMap)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("paragraphs", items);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        result.put("totalPages", (int) Math.ceil((double) total / pageSize));
        return result;
    }

    public List<Map<String, Object>> getChapters(Integer bookId) {
        List<Paragraph> all = paragraphRepo.findByBookIdOrderByPosition(bookId);
        List<Paragraph> headings = all.stream().filter(p -> isHeading(p.getOriginalText())).toList();

        List<Map<String, Object>> chapters = new ArrayList<>();
        String prevText = null;
        for (Paragraph h : headings) {
            if (!h.getOriginalText().equals(prevText)) {
                Map<String, Object> ch = new LinkedHashMap<>();
                ch.put("id", h.getId());
                ch.put("position", h.getPosition());
                ch.put("originalText", h.getOriginalText());
                ch.put("translatedText", h.getTranslatedText());
                chapters.add(ch);
                prevText = h.getOriginalText();
            }
        }
        return chapters;
    }

    public Map<String, Object> search(Integer bookId, String q, int limit) {
        PageRequest pr = PageRequest.of(0, limit);
        List<Paragraph> results = paragraphRepo.searchByBookId(bookId, q, pr);

        List<Map<String, Object>> items = results.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("position", r.getPosition());
            m.put("originalText", r.getOriginalText());
            m.put("translatedText", r.getTranslatedText());
            m.put("isHeading", isHeading(r.getOriginalText()));
            return m;
        }).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("results", items);
        result.put("total", items.size());
        result.put("query", q);
        return result;
    }

    public Map<String, Object> getStats(Integer bookId) {
        Book book = bookRepo.findById(bookId).orElseThrow();
        Long wordCount = bookRepo.countWordsByBookId(bookId);
        int wc = wordCount != null ? wordCount.intValue() : 0;
        int pct = book.getTotalParagraphs() > 0
                ? Math.round((float) book.getTranslatedParagraphs() / book.getTotalParagraphs() * 100)
                : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bookId", book.getId());
        result.put("totalParagraphs", book.getTotalParagraphs());
        result.put("translatedParagraphs", book.getTranslatedParagraphs());
        result.put("wordCount", wc);
        result.put("uniqueWordsLookedUp", 0);
        result.put("progressPercent", pct);
        return result;
    }

    public Map<String, Object> paragraphToMap(Paragraph p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("bookId", p.getBookId());
        m.put("position", p.getPosition());
        m.put("originalText", p.getOriginalText());
        m.put("translatedText", p.getTranslatedText());
        m.put("isTranslated", p.isTranslated());
        return m;
    }

    public static boolean isHeading(String text) {
        String t = text.trim();
        if (t.length() > 120) return false;
        if (Pattern.compile("^\\d+\\.\\s+\\S").matcher(t).find()) return true;
        if (Pattern.compile("^(chapter|part|section|prologue|epilogue|afterword|foreword|preface|act|scene|book)\\b", Pattern.CASE_INSENSITIVE).matcher(t).find()) return true;
        if (Pattern.compile("^[IVXLCDM]+\\.?\\s*$").matcher(t).matches()) return true;
        if (t.length() <= 60 && t.equals(t.toUpperCase()) && Pattern.compile("^[A-Z][A-Z\\s\\d'\"\\-]{2,}$").matcher(t).matches()) return true;
        return false;
    }
}
