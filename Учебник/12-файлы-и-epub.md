# Глава 12. Загрузка файлов и парсинг EPUB

> **Зачем эта глава:** научиться принимать файлы по HTTP и работать с .epub (это просто ZIP с XML).
> **Файлы проекта:**
> - `artifacts/api-server/src/main/java/com/lingua/api/controller/UploadController.java`
> - `artifacts/api-server/src/main/java/com/lingua/api/service/EpubParser.java`

## Часть 1. Загрузка файла — `MultipartFile`

В HTML загрузка файла выглядит так:
```html
<form enctype="multipart/form-data" method="POST">
  <input type="file" name="file"/>
  <input type="text" name="title"/>
</form>
```

Это особый формат запроса — `multipart/form-data` — где разные поля идут в разных «частях».

Spring обрабатывает это автоматически, если включен multipart (см. `application.properties`):
```properties
spring.servlet.multipart.enabled=true
spring.servlet.multipart.max-file-size=50MB
```

### Контроллер

```java
@RestController
@RequiredArgsConstructor
public class UploadController {

    private final BookService bookService;
    private final EpubParser epubParser;

    @PostMapping("/books/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String customTitle,
            @RequestParam(value = "author", required = false) String customAuthor) {
```

- `@RequestParam("file") MultipartFile file` — берёт часть с именем `file` и оборачивает её в `MultipartFile`.
- `MultipartFile` — обёртка Spring над загруженным файлом.

Полезные методы `MultipartFile`:
- `file.getBytes()` → `byte[]` со всем содержимым.
- `file.getOriginalFilename()` → исходное имя файла.
- `file.getContentType()` → MIME-тип, который прислал браузер (`text/plain`, `application/epub+zip`).
- `file.getSize()` → размер в байтах.
- `file.isEmpty()` → пустой ли.
- `file.getInputStream()` → для потоковой обработки больших файлов.

### Валидация и определение типа

```java
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String detectedTitle = customTitle != null && !customTitle.isBlank()
                ? customTitle.trim()
                : originalName.replaceAll("(?i)\\.(txt|epub)$", "").replace("-", " ").replace("_", " ");
```

- Проверяем, что файл вообще пришёл.
- Имя книги: либо пользователь передал явно (`customTitle`), либо берём имя файла без расширения, дефисы и подчёркивания → пробелы.

`(?i)` в начале регулярки = case-insensitive.

### Обработка файла

```java
        try {
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
            if (paragraphs.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Could not extract readable text from the file"));
            }

            String author = customAuthor != null && !customAuthor.isBlank() ? customAuthor.trim() : null;
            Book book = bookService.createBookFromParagraphs(detectedTitle, author, paragraphs);
```

- Если EPUB — парсим как ZIP, достаём текст и заголовок.
- Если TXT — берём как есть.
- Делим на параграфы.
- Создаём книгу через сервис.

### Запись `record` для возврата данных

В EpubParser используется:
```java
public record EpubResult(String title, String content) {}
```

`record` (Java 14+) — короткий способ объявить **immutable** (неизменяемый) data-class. Эквивалент:
```java
public final class EpubResult {
    private final String title;
    private final String content;
    public EpubResult(String title, String content) { ... }
    public String title() { return title; }
    public String content() { return content; }
    // + equals, hashCode, toString
}
```

Идеально для DTO и возврата нескольких значений из метода.

## Часть 2. Парсинг EPUB

### Что такое EPUB

EPUB — это **.zip-архив** с особой структурой:
- `META-INF/container.xml` — указывает на главный файл `.opf`.
- Файл `*.opf` (Open Packaging Format) — описание всей книги:
  - `<dc:title>` — заголовок,
  - `<manifest>` — список всех файлов внутри (HTML, CSS, картинки),
  - `<spine>` — порядок чтения файлов.
- Сами главы — `*.html` или `*.xhtml`.

Алгоритм:
1. Распаковать .zip.
2. Найти `.opf`.
3. Из него вытащить заголовок, манифест и spine.
4. Пройти по spine: открыть каждый HTML, вырезать теги, склеить тексты.

### Шаг 1. Чтение .zip

```java
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
```

- `@Component` — делаем класс бином (как `@Service`, но семантически нейтрально).
- `ByteArrayInputStream(data)` — превращаем массив байтов в поток.
- `ZipInputStream` — стандартный Java-класс для чтения ZIP.
- `try (...)` — **try-with-resources**: ресурс автоматически закроется в конце блока. Обязательно используй для всего, что implements `AutoCloseable`.
- Цикл `while ((entry = zip.getNextEntry()) != null)` — читаем по файлу.
- Складываем содержимое в `Map<имя_файла, байты>`.

### Шаг 2. Найти .opf

```java
        String opfName = entries.keySet().stream()
                .filter(n -> n.endsWith(".opf"))
                .findFirst()
                .orElse(null);
```

Stream API: «возьми все ключи Map → отфильтруй по концу имени → возьми первый».

### Шаг 3. Достать заголовок

```java
        String opfContent = new String(entries.get(opfName));

        Matcher titleM = Pattern.compile("<dc:title[^>]*>([^<]+)</dc:title>", Pattern.CASE_INSENSITIVE)
                .matcher(opfContent);
        if (titleM.find()) {
            title = titleM.group(1).trim();
        }
```

Регулярка ищет `<dc:title>...текст...</dc:title>`. Скобки `(...)` — захватывают текст внутри.

> ⚠️ **Парсить XML регулярками — это плохо.** Для серьёзных проектов используй `org.w3c.dom.*` или Jsoup. Но для EPUB, который генерируется единообразно, регулярок достаточно.

### Шаг 4. Прочитать манифест и spine

```java
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
```

Сначала собираем `id → href`. Потом проходим по spine и для каждого `idref` находим href. Получаем упорядоченный список HTML-файлов.

### Шаг 5. Вырезать HTML-теги

```java
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
```

По шагам:
1. Удалить `<script>...</script>` целиком.
2. Удалить `<style>...</style>` целиком.
3. Закрывающие теги блочных элементов → перенос строки.
4. `<br>` → перенос строки.
5. Убрать вообще все остальные теги.
6. Раскодировать HTML-entities (`&amp;` → `&` и т.д.).

Флаги регулярок:
- `(?i)` — case-insensitive.
- `(?is)` — i + s (точка матчит и переносы строк).

### Шаг 6. Делим на параграфы

```java
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
```

- `text.split("\n{2,}")` — делим там, где две или более переноса (= пустая строка).
- В каждом куске: одиночные переносы → пробелы, схлопываем кратные пробелы.
- Отбрасываем мусор короче 3 символов.

## Контрольные вопросы

1. Что такое `MultipartFile`? Какие у него полезные методы?
2. Что такое `record` в Java?
3. Зачем `try (...)` (try-with-resources)?
4. Как устроен EPUB на самом деле?
5. Почему вместо парсинга XML регулярками лучше использовать Jsoup?

## Мини-упражнение

Расширь `UploadController` так, чтобы он отвергал файлы с расширениями кроме `.txt` и `.epub`, возвращая 400 с понятной ошибкой.

<details>
<summary>Решение</summary>

```java
String lower = originalName.toLowerCase();
if (!lower.endsWith(".txt") && !lower.endsWith(".epub")) {
    return ResponseEntity.badRequest().body(Map.of("error", "Only .txt and .epub files are allowed"));
}
```

Вставь сразу после получения `originalName`.
</details>

## Что дальше

Финальный технический рывок: разберём, как работать с PG-массивами и звать внешние API: **[Глава 13 — JdbcTemplate и OpenAI →](13-jdbc-и-openai.md)**
