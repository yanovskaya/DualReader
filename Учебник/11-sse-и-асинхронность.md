# Глава 11. SSE и асинхронность

> **Зачем эта глава:** разобрать, как сервер шлёт прогресс-обновления клиенту в реальном времени.
> **Файл проекта:** `artifacts/api-server/src/main/java/com/lingua/api/service/TranslationService.java`

## Проблема

Перевод книги — медленная операция (минуты). Если делать её синхронно:
1. Клиент шлёт `POST /api/books/5/translate`.
2. Сервер начинает переводить.
3. Клиент **5 минут** ждёт ответа.
4. Прогресса не видно.
5. Браузер скорее всего отвалится по timeout.

Решение в нашей архитектуре: **SSE** + **`@Async`**.

## Что такое SSE (Server-Sent Events)

SSE — стандарт для **однонаправленного потока сообщений** от сервера к клиенту по обычному HTTP. Клиент открывает соединение, сервер шлёт текстовые «события» сколько хочет, потом закрывает.

Формат на проводе:

```
data: {"type":"started","total":392}

data: {"type":"progress","translated":8,"percent":2}

data: {"type":"progress","translated":16,"percent":4}

data: {"type":"done"}
```

Каждое событие — строка `data: <json>`, разделённая пустой строкой.

В браузере читать это легко:
```javascript
const es = new EventSource('/api/books/5/translate');
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Что такое `@Async`

Аннотация Spring, которая говорит: «выполни этот метод в **другом потоке**».

Без `@Async`:
```java
public void slowMethod() { /* 5 минут */ }
// вызывающий поток ждёт 5 минут
```

С `@Async`:
```java
@Async
public void slowMethod() { /* 5 минут */ }
// вызывающий поток получает управление мгновенно;
// метод запускается в отдельном потоке
```

> ⚠️ Чтобы `@Async` работал, нужно `@EnableAsync` где-то в конфигурации (у нас — на главном классе).

Можно указать **имя пула**, в котором запускать:
```java
@Async("translationExecutor")  // ← имя нашего пула из AsyncConfig
public void slowMethod() { ... }
```

## Эндпоинт-инициатор

Контроллер запускает перевод и сразу отдаёт `SseEmitter`:

```java
@PostMapping("/books/{id}/translate")
public SseEmitter translate(
        @PathVariable Integer id,
        @RequestBody(required = false) Map<String, Object> body) {
    int batchSize = 8;
    if (body != null && body.get("batchSize") != null) {
        try { batchSize = Integer.parseInt(body.get("batchSize").toString()); } catch (Exception ignored) {}
    }
    SseEmitter emitter = new SseEmitter(300_000L);   // таймаут 5 минут
    translationService.translateBook(id, batchSize, emitter);
    return emitter;
}
```

Что происходит:
1. Создаём `SseEmitter` с таймаутом.
2. Зовём `translationService.translateBook(...)` — этот метод помечен `@Async`, поэтому **сразу** возвращает управление.
3. Возвращаем `emitter` — Spring держит HTTP-соединение открытым.
4. В фоновом потоке `translateBook` потихоньку шлёт события через `emitter.send(...)`.
5. Когда фоновый поток вызывает `emitter.complete()` — соединение закрывается.

## Сервис перевода — построчный разбор

```java
@Service
@RequiredArgsConstructor
public class TranslationService {

    private final BookRepository bookRepo;
    private final ParagraphRepository paragraphRepo;
    private final OpenAiService openAi;
    private final ObjectMapper mapper = new ObjectMapper();

    @Async("translationExecutor")
    public void translateBook(Integer bookId, int batchSize, SseEmitter emitter) {
```

- `@Async("translationExecutor")` — запустить в нашем пуле из `AsyncConfig`.
- Метод возвращает `void` — это нормально для async (можно и `CompletableFuture<...>`).
- Принимает `SseEmitter` от контроллера, чтобы слать в него события.

```java
        try {
            Optional<Book> optBook = bookRepo.findById(bookId);
            if (optBook.isEmpty()) {
                send(emitter, Map.of("error", "Book not found"));
                emitter.complete();
                return;
            }

            Book book = optBook.get();
            List<Paragraph> untranslated = paragraphRepo.findByBookIdAndIsTranslatedFalseOrderByPosition(bookId);

            if (untranslated.isEmpty()) {
                send(emitter, Map.of("done", true, "message", "All paragraphs already translated"));
                emitter.complete();
                return;
            }

            book.setTranslationStatus("in_progress");
            bookRepo.save(book);

            send(emitter, Map.of("started", true, "total", untranslated.size()));
```

Подготовка:
- Достать книгу. Нет → событие об ошибке + `complete()`.
- Достать непереведённые абзацы. Если все уже переведены → событие `done`.
- Поставить статус `in_progress` и сохранить.
- Послать стартовое событие.

```java
            int translated = book.getTranslatedParagraphs();

            for (int i = 0; i < untranslated.size(); i += batchSize) {
                List<Paragraph> batch = untranslated.subList(i, Math.min(i + batchSize, untranslated.size()));
                boolean isLast = (i + batchSize) >= untranslated.size();
```

Идём батчами по `batchSize` параграфов. `subList` возвращает «окно» в исходный список, не копируя его.

```java
                StringBuilder textsToTranslate = new StringBuilder();
                for (int j = 0; j < batch.size(); j++) {
                    textsToTranslate.append("[").append(j + 1).append("] ").append(batch.get(j).getOriginalText());
                    if (j < batch.size() - 1) textsToTranslate.append("\n\n");
                }
```

Собираем тексты в один промпт, нумеруя `[1]`, `[2]`, ... Это нужно, чтобы потом разобрать ответ AI и сопоставить переводы с исходниками.

```java
                List<Map<String, String>> messages = List.of(
                        Map.of("role", "system", "content",
                                "You are a literary translator. Translate the following English paragraphs into Russian. " +
                                "Each paragraph is numbered with [N]. " +
                                "Return ONLY the translated paragraphs in the same numbered format [N]..."),
                        Map.of("role", "user", "content", textsToTranslate.toString())
                );

                String translationText = openAi.complete("gpt-4.1-mini", 8192, messages);
```

Зовём OpenAI. (Подробнее про `OpenAiService` — в главе 13.)

```java
                Map<Integer, String> translationMap = new HashMap<>();
                for (String line : translationText.split("\n\n+")) {
                    Matcher m = Pattern.compile("^\\[(\\d+)\\]\\s*([\\s\\S]+)").matcher(line.trim());
                    if (m.find()) {
                        translationMap.put(Integer.parseInt(m.group(1)), m.group(2).trim());
                    }
                }
```

Разбираем ответ AI: «`[N] перевод`» → `Map<номер, перевод>`.

`m.group(1)` — содержимое первой круглой скобки в регулярке (число `N`).
`m.group(2)` — второй (сам текст перевода).

```java
                for (int j = 0; j < batch.size(); j++) {
                    Paragraph paragraph = batch.get(j);
                    String translation = translationMap.getOrDefault(j + 1, translationText);
                    paragraph.setTranslatedText(translation);
                    paragraph.setTranslated(true);
                    paragraphRepo.save(paragraph);
                    translated++;
                }

                book = bookRepo.findById(bookId).orElse(book);
                book.setTranslatedParagraphs(translated);
                book.setTranslationStatus(isLast ? "completed" : "in_progress");
                bookRepo.save(book);

                int pct = book.getTotalParagraphs() > 0
                        ? Math.round((float) translated / book.getTotalParagraphs() * 100)
                        : 0;
                send(emitter, Map.of("progress", true, "translated", translated, "total", book.getTotalParagraphs(), "percent", pct));

                if (!isLast) {
                    Thread.sleep(200);
                }
            }
```

После каждого батча:
- Сохранить переводы абзацев.
- Обновить статус книги.
- Послать событие прогресса.
- Маленькая пауза (200 мс) — чтобы не упереться в OpenAI rate limit.

```java
            send(emitter, Map.of("done", true));
            emitter.complete();

        } catch (Exception e) {
            try {
                send(emitter, Map.of("error", "Translation failed: " + e.getMessage()));
                emitter.complete();
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        }
    }
```

В конце — финальное событие `done` и закрытие. Если что-то упало — пытаемся послать ошибку клиенту, иначе просто закрываем с ошибкой.

## Helper-метод `send`

```java
    private void send(SseEmitter emitter, Map<String, Object> data) {
        try {
            emitter.send(SseEmitter.event().data(mapper.writeValueAsString(data)));
        } catch (Exception e) {
            // Client disconnected
        }
    }
```

- `mapper.writeValueAsString(data)` — Jackson сериализует `Map` в JSON-строку.
- `SseEmitter.event().data(jsonString)` — обёртка, говорящая «это поле data:».
- `emitter.send(...)` — реально шлёт.
- Если клиент закрыл вкладку — `send` бросит исключение, мы его молча проглатываем.

## Когда использовать SSE

- Прогресс-бары (наш случай).
- Уведомления.
- Лента событий.
- Чаты (где сообщения идут только от сервера).

Когда **НЕ** SSE:
- Нужна двусторонняя связь (клиент тоже шлёт сообщения) → используй WebSocket.
- Нужно один раз получить ответ → обычный HTTP.

## Контрольные вопросы

1. Зачем `@Async` на методе `translateBook`?
2. Что такое `SseEmitter`? Что произойдёт, если не вызвать `emitter.complete()`?
3. Чем SSE отличается от WebSocket?
4. Что такое `@EnableAsync` и где она у нас?
5. Почему мы делаем `Thread.sleep(200)` между батчами?

## Мини-упражнение

Сделай новый эндпоинт `GET /api/countdown?from=10`, который шлёт SSE-события каждую секунду: `{n: 10}`, `{n: 9}`, ..., `{n: 0}`, `{done: true}`.

<details>
<summary>Подсказка</summary>

```java
@GetMapping("/countdown")
public SseEmitter countdown(@RequestParam(defaultValue = "10") int from) {
    SseEmitter emitter = new SseEmitter(60_000L);
    countdownService.run(from, emitter);
    return emitter;
}
```

В сервисе:
```java
@Async("translationExecutor")
public void run(int from, SseEmitter emitter) {
    try {
        for (int i = from; i >= 0; i--) {
            emitter.send(SseEmitter.event().data("{\"n\":" + i + "}"));
            Thread.sleep(1000);
        }
        emitter.send(SseEmitter.event().data("{\"done\":true}"));
        emitter.complete();
    } catch (Exception e) {
        emitter.completeWithError(e);
    }
}
```
</details>

## Что дальше

Теперь — две большие специфичные темы: загрузка файлов и парсинг EPUB: **[Глава 12 — Файлы и EPUB →](12-файлы-и-epub.md)**
