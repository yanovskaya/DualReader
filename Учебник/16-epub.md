# Шаг 16. Парсинг `.epub`

🎯 **Цель:** загрузка работает не только для .txt, но и для .epub.

📁 **Файлы шага:**
- `src/main/java/com/lingua/api/service/EpubParser.java` (новый)
- `src/main/java/com/lingua/api/controller/UploadController.java` (используем парсер)

## Что такое EPUB

EPUB — это **обычный .zip-архив** с особой структурой:
- `*.opf` — манифест: список файлов и порядок чтения.
- `*.html` / `*.xhtml` — главы.

Алгоритм:
1. Распаковать ZIP.
2. Найти `.opf`, достать заголовок и список глав.
3. Пройти по главам, вырезать HTML-теги, склеить тексты.

## 1. Класс `EpubParser`

**`src/main/java/com/lingua/api/service/EpubParser.java`** (новый):

```java
package com.lingua.api.service;

import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Component
public class EpubParser {

    public record EpubResult(String title, String content) {}

    public EpubResult parse(byte[] data) throws IOException {
        Map<String, byte[]> entries = new HashMap<>();

        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.isDirectory()) {
                    entries.put(entry.getName(), zip.readAllBytes());
                }
                zip.closeEntry();
            }
        }

        String opfName = entries.keySet().stream()
                .filter(n -> n.endsWith(".opf"))
                .findFirst()
                .orElse(null);

        String title = "Untitled";
        List<String> contentFiles = new ArrayList<>();

        if (opfName != null) {
            String opfContent = new String(entries.get(opfName));

            Matcher titleM = Pattern.compile("<dc:title[^>]*>([^<]+)</dc:title>", Pattern.CASE_INSENSITIVE)
                    .matcher(opfContent);
            if (titleM.find()) {
                title = titleM.group(1).trim();
            }

            String opfDir = opfName.contains("/") ? opfName.substring(0, opfName.lastIndexOf('/') + 1) : "";
            Map<String, String> idToHref = new HashMap<>();
            Matcher manifestM = Pattern.compile("<item[^>]+id=\"([^\"]+)\"[^>]+href=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE)
                    .matcher(opfContent);
            while (manifestM.find()) {
                idToHref.put(manifestM.group(1), manifestM.group(2));
            }

            Matcher spineM = Pattern.compile("idref=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE).matcher(opfContent);
            while (spineM.find()) {
                String href = idToHref.get(spineM.group(1));
                if (href != null) {
                    contentFiles.add(opfDir + href);
                }
            }
        }

        if (contentFiles.isEmpty()) {
            entries.keySet().stream()
                    .filter(n -> n.matches("(?i).*\\.(html|xhtml|htm)") && !n.contains("toc"))
                    .sorted()
                    .forEach(contentFiles::add);
        }

        StringBuilder sb = new StringBuilder();
        for (String file : contentFiles) {
            byte[] fileData = entries.get(file);
            if (fileData == null) {
                String stripped = file.contains("/") ? file.substring(file.lastIndexOf('/') + 1) : file;
                fileData = entries.entrySet().stream()
                        .filter(e -> e.getKey().endsWith("/" + stripped) || e.getKey().equals(stripped))
                        .map(Map.Entry::getValue)
                        .findFirst()
                        .orElse(null);
            }
            if (fileData != null) {
                sb.append(extractTextFromHtml(new String(fileData))).append("\n\n");
            }
        }

        return new EpubResult(title, sb.toString());
    }

    private String extractTextFromHtml(String html) {
        String text = html.replaceAll("(?is)<script[\\s\\S]*?</script>", "");
        text = text.replaceAll("(?is)<style[\\s\\S]*?</style>", "");
        text = text.replaceAll("(?i)</(p|div|h[1-6]|li|br|tr|blockquote)>", "\n");
        text = text.replaceAll("(?i)<br\\s*/?>", "\n");
        text = text.replaceAll("<[^>]+>", "");
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ");
        return text;
    }

    public List<String> splitIntoParagraphs(String text) {
        List<String> result = new ArrayList<>();
        for (String p : text.split("\n{2,}")) {
            String trimmed = p.replace("\n", " ").replaceAll("\\s+", " ").trim();
            if (trimmed.length() > 3) {
                result.add(trimmed);
            }
        }
        return result;
    }
}
```

🧠 **Разбор ключевых моментов:**

### `@Component`

Делает класс бином. То же что `@Service`, но `@Component` нейтрально (не сервис, не репозиторий — просто компонент).

### `record EpubResult`

```java
public record EpubResult(String title, String content) {}
```

`record` (Java 14+) — короткий способ объявить immutable data-class. Эквивалентен полному классу с двумя `final`-полями, конструктором, геттерами `title()` и `content()`, equals/hashCode.

### try-with-resources

```java
try (ZipInputStream zip = new ZipInputStream(...)) {
    ...
}
```

Скобки после `try` — **try-with-resources**. Ресурс автоматически закроется в конце блока. Используй для всего, что implements `AutoCloseable`.

### Извлечение текста из HTML

Регулярки удаляют:
1. `<script>...</script>` целиком.
2. `<style>...</style>` целиком.
3. Закрывающие теги блоков → перенос строки.
4. Все остальные теги.
5. HTML-entities (`&amp;` → `&`).

> Парсить HTML регулярками — спорно, но для EPUB-разметки достаточно.

## 2. Используем парсер в контроллере

В `UploadController.java` добавь поле и инжект:

```java
private final BookService bookService;
private final EpubParser epubParser;   // ← добавить
```

И замени блок чтения файла. Заменить:

```java
byte[] bytes = file.getBytes();
String content = new String(bytes);

List<String> paragraphs = Arrays.stream(content.split("\n\n+"))
        .map(p -> p.replace("\n", " ").replaceAll("\\s+", " ").trim())
        .filter(p -> p.length() > 3)
        .toList();
```

на:

```java
byte[] bytes = file.getBytes();
String content;

boolean isEpub = originalName.toLowerCase().endsWith(".epub")
        || "application/epub+zip".equals(file.getContentType());

if (isEpub) {
    EpubParser.EpubResult parsed = epubParser.parse(bytes);
    content = parsed.content();
    if (customTitle == null || customTitle.isBlank()) {
        detectedTitle = parsed.title();
    }
} else {
    content = new String(bytes);
}

List<String> paragraphs = epubParser.splitIntoParagraphs(content);
```

Также убери импорт `Arrays` (больше не нужен) — IDE подскажет.

## ✅ Проверка

```bash
curl http://localhost:8080/books/upload \
  -F "file=@/path/to/book.epub"
```

Если есть .epub — должна загрузиться и распарситься. Заголовок книги возьмётся из метаданных EPUB.

```bash
curl http://localhost:8080/books
```

— должна появиться новая запись.

## 🤔 Проверь себя

  1. Что внутри `.epub` — почему мы используем `ZipInputStream`?
  2. Зачем нам Jsoup, если HTML можно парсить регулярками?
  3. Почему мы читаем все `.xhtml`/`.html` файлы и склеиваем — нельзя ли сразу взять один?

  <details>
  <summary>Мини-упражнение: попробуй на настоящем .epub</summary>

  Скачай любую публично-доступную книгу в `.epub` (например, с Project Gutenberg) и загрузи через `POST /upload`. Проверь:

  ```bash
  curl -F "file=@book.epub" -F "title=Test" -F "author=PG" \
       http://localhost:8080/books/upload
  ```

  Открой созданную книгу через `GET /books/{id}/paragraphs` — текст читаемый?
  </details>

  ## ➡️ Дальше

Базовая функциональность готова. Теперь — самое интересное: автоматический перевод. [Шаг 17 — Сервис OpenAI →](17-openai.md)
