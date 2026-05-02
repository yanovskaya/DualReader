# Шаг 07. `GET /books` и `POST /books`

🎯 **Цель:** через HTTP можно создавать книги и видеть их список.

📁 **Файлы шага:**
- `src/main/java/com/lingua/api/service/BookService.java` (новый)
- `src/main/java/com/lingua/api/controller/BookController.java` (новый)

## 1. Сервис

Слой сервиса — это **бизнес-логика**. Он зовёт репозитории и не знает про HTTP.

```bash
mkdir -p src/main/java/com/lingua/api/service
```

**`src/main/java/com/lingua/api/service/BookService.java`**

```java
package com.lingua.api.service;

import com.lingua.api.model.Book;
import com.lingua.api.repository.BookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BookService {

    private final BookRepository bookRepo;

    public List<Book> listBooks() {
        return bookRepo.findAllByOrderByCreatedAtAsc();
    }

    public Optional<Book> getBook(Integer id) {
        return bookRepo.findById(id);
    }

    public Book createBook(String title, String author, String language) {
        Book book = new Book();
        book.setTitle(title);
        book.setAuthor(author);
        book.setLanguage(language != null ? language : "en");
        bookRepo.save(book);
        return book;
    }
}
```

🧠 **Разбор:**

- `@Service` — «это бин-сервис». Spring создаст его при старте.
- `@RequiredArgsConstructor` (Lombok) — сгенерирует конструктор со всеми `final`-полями. Spring передаст в этот конструктор уже созданный `BookRepository`.
- Это и есть **constructor-based dependency injection** — рекомендуемый способ DI.
- После `bookRepo.save(book)` Hibernate выполнит INSERT и положит сгенерированный `id` в `book.id`.

## 2. Контроллер

```bash
mkdir -p src/main/java/com/lingua/api/controller
```

(папка уже была от `HealthController`)

**`src/main/java/com/lingua/api/controller/BookController.java`**

```java
package com.lingua.api.controller;

import com.lingua.api.model.Book;
import com.lingua.api.service.BookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class BookController {

    private final BookService bookService;

    @GetMapping("/books")
    public List<Map<String, Object>> listBooks() {
        return bookService.listBooks().stream().map(this::bookToMap).toList();
    }

    @PostMapping("/books")
    public ResponseEntity<?> createBook(@RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String author = (String) body.get("author");
        String language = (String) body.get("language");

        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "title is required"));
        }

        Book book = bookService.createBook(title, author, language);
        return ResponseEntity.status(201).body(bookToMap(book));
    }

    private Map<String, Object> bookToMap(Book b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("title", b.getTitle());
        m.put("author", b.getAuthor());
        m.put("language", b.getLanguage());
        m.put("totalParagraphs", b.getTotalParagraphs());
        m.put("translatedParagraphs", b.getTranslatedParagraphs());
        m.put("translationStatus", b.getTranslationStatus());
        m.put("createdAt", b.getCreatedAt().toString());
        return m;
    }
}
```

🧠 **Разбор:**

- `@RestController` = «контроллер с JSON-ответами».
- `@GetMapping("/books")` → `GET /books`.
- `@PostMapping("/books")` → `POST /books`.
- `@RequestBody Map<String, Object> body` — Jackson распарсит JSON-тело в `Map`.
- Валидация: если нет `title` → 400 `Bad Request` с понятным сообщением.
- `ResponseEntity.status(201)` — код 201 Created для нового ресурса.
- `bookToMap` — превращает сущность в `Map` для JSON-ответа. Зачем не отдавать сущность напрямую? Чтобы контролировать формат и не зависеть от изменений модели.
- `LinkedHashMap` — сохраняет порядок ключей в JSON.

## ✅ Проверка

Перезапусти сервер. Затем:

```bash
# Список (пока пусто)
curl http://localhost:8080/books

# Создаём книгу
curl -X POST http://localhost:8080/books \
  -H 'Content-Type: application/json' \
  -d '{"title":"My First Book","author":"Me"}'

# Список снова
curl http://localhost:8080/books

# Без title — должен вернуть 400
curl -i -X POST http://localhost:8080/books \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Должно работать всё:
- Первый запрос — `[]`.
- Второй — JSON книги с `id`.
- Третий — массив с одной книгой.
- Четвёртый — статус 400 и `{"error":"title is required"}`.

🎉 У тебя работает CRUD!

## 🤔 Проверь себя

  1. Зачем нужен слой Service, если можно вызывать репозиторий прямо из контроллера?
  2. Что делает `@RequestBody` и какая библиотека превращает JSON в Java-объект?
  3. Как Spring подставляет в конструктор `BookController` объект `BookService` — где это «волшебство»?

  <details>
  <summary>Мини-упражнение: верни 201 вместо 200 на POST</summary>

  По REST-конвенции `POST` должен возвращать `201 Created`. Поменяй метод:

  ```java
  @PostMapping("/books")
  public ResponseEntity<Book> create(@RequestBody Book book) {
      Book saved = bookService.create(book);
      return ResponseEntity.status(HttpStatus.CREATED).body(saved);
  }
  ```

  Проверь: `curl -i -X POST ...` — первая строка ответа `HTTP/1.1 201`.
  </details>

  ## ➡️ Дальше

Книги — это просто строки в БД. Добавим параграфы. [Шаг 08 — Сущность Paragraph →](08-сущность-paragraph.md)
