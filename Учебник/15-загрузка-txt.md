# Шаг 15. Загрузка `.txt`

🎯 **Цель:** работает `POST /books/upload` для текстовых файлов.

📁 **Файлы шага:**
- `src/main/resources/application.properties` (включаем multipart)
- `src/main/java/com/lingua/api/service/BookService.java` (добавляем метод)
- `src/main/java/com/lingua/api/controller/UploadController.java` (новый)

## 1. Настройки для загрузки файлов

В `application.properties` добавь:

```properties
spring.servlet.multipart.enabled=true
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB
```

🧠 По умолчанию Spring Boot ограничивает загрузку файлами в 1 МБ. Поднимаем до 50 МБ.

## 2. Метод сервиса

Создание книги из уже готового списка параграфов (без разбивки текста):

В `BookService.java`:

```java
@Transactional
public Book createBookFromParagraphs(String title, String author, List<String> paragraphTexts) {
    Book book = new Book();
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
```

> Заметила, что почти такой же код, как в `createBook`? В будущем можно отрефакторить, но пока оставим как есть.

## 3. Контроллер

**`src/main/java/com/lingua/api/controller/UploadController.java`** (новый файл):

```java
package com.lingua.api.controller;

import com.lingua.api.model.Book;
import com.lingua.api.service.BookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class UploadController {

    private final BookService bookService;

    @PostMapping("/books/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String customTitle,
            @RequestParam(value = "author", required = false) String customAuthor) {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String detectedTitle = customTitle != null && !customTitle.isBlank()
                ? customTitle.trim()
                : originalName.replaceAll("(?i)\\.(txt|epub)$", "").replace("-", " ").replace("_", " ");

        try {
            byte[] bytes = file.getBytes();
            String content = new String(bytes);

            List<String> paragraphs = Arrays.stream(content.split("\n\n+"))
                    .map(p -> p.replace("\n", " ").replaceAll("\\s+", " ").trim())
                    .filter(p -> p.length() > 3)
                    .toList();

            if (paragraphs.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Could not extract readable text from the file"));
            }

            String author = customAuthor != null && !customAuthor.isBlank() ? customAuthor.trim() : null;
            Book book = bookService.createBookFromParagraphs(detectedTitle, author, paragraphs);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", book.getId());
            m.put("title", book.getTitle());
            m.put("totalParagraphs", book.getTotalParagraphs());
            return ResponseEntity.status(201).body(m);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to process file"));
        }
    }
}
```

🧠 **Что нового:**

### `MultipartFile`

Spring оборачивает каждый загруженный файл в `MultipartFile`. Полезные методы:
- `file.getBytes()` → `byte[]` всё содержимое.
- `file.getOriginalFilename()` → исходное имя.
- `file.getContentType()` → MIME-тип.
- `file.isEmpty()` → пустой ли.

### `@RequestParam("file") MultipartFile file`

Берёт часть с именем `file` из multipart-запроса.

### Регулярка для имени

`originalName.replaceAll("(?i)\\.(txt|epub)$", "")` — убираем расширение. `(?i)` — без учёта регистра, `$` — конец строки.

## ✅ Проверка

Сделай тестовый файл:
```bash
echo -e "First paragraph long enough.\n\nSecond paragraph long enough." > /tmp/test.txt
```

Загрузи:
```bash
curl -X POST http://localhost:8080/books/upload \
  -F "file=@/tmp/test.txt" \
  -F "title=My Uploaded Book"
```

Ожидаем JSON с `id` и `totalParagraphs: 2`.

## 🤔 Проверь себя

  1. Что такое `multipart/form-data` и почему обычный JSON не подходит для файлов?
  2. Что делает `MultipartFile` и откуда Spring берёт его содержимое?
  3. Зачем мы проверяем `getOriginalFilename()` и расширение?

  <details>
  <summary>Мини-упражнение: ограничь размер</summary>

  Добавь в `application.properties`:

  ```properties
  spring.servlet.multipart.max-file-size=10MB
  spring.servlet.multipart.max-request-size=10MB
  ```

  Проверь, что загрузка файла больше 10 МБ возвращает ошибку `413 Payload Too Large` (или `MaxUploadSizeExceededException` в логах).
  </details>

  ## ➡️ Дальше

Текстовые файлы загружаются. Теперь .epub. [Шаг 16 — Парсинг .epub →](16-epub.md)
