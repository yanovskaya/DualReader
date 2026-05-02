# Шаг 19. SSE-прогресс

🎯 **Цель:** клиент в реальном времени получает события прогресса перевода.

📁 **Файлы шага:**
- `src/main/java/com/lingua/api/service/TranslationService.java` (расширяем — добавляем `SseEmitter`)
- `src/main/java/com/lingua/api/controller/BookController.java` (меняем эндпоинт `/translate`)

## Что такое SSE

**Server-Sent Events** — стандарт для **однонаправленного потока** сообщений от сервера к клиенту по обычному HTTP. Идеален для прогресс-баров.

Формат на проводе:
```
data: {"started":true,"total":392}

data: {"progress":true,"translated":8,"percent":2}

data: {"done":true}
```

В браузере:
```javascript
const es = new EventSource('/books/5/translate');
es.onmessage = e => console.log(JSON.parse(e.data));
```

## 1. Меняем сервис

В `TranslationService.java` добавь импорты:

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
```

И поле в класс:
```java
private final ObjectMapper mapper = new ObjectMapper();
```

Замени **весь** метод `translateBook` на (изменения помечены `// ←`):

```java
@Async("translationExecutor")
public void translateBook(Integer bookId, int batchSize, SseEmitter emitter) {  // ← добавлен emitter
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

        send(emitter, Map.of("started", true, "total", untranslated.size()));   // ← старт

        int translated = book.getTranslatedParagraphs();

        for (int i = 0; i < untranslated.size(); i += batchSize) {
            List<Paragraph> batch = untranslated.subList(i, Math.min(i + batchSize, untranslated.size()));
            boolean isLast = (i + batchSize) >= untranslated.size();

            StringBuilder textsToTranslate = new StringBuilder();
            for (int j = 0; j < batch.size(); j++) {
                textsToTranslate.append("[").append(j + 1).append("] ").append(batch.get(j).getOriginalText());
                if (j < batch.size() - 1) textsToTranslate.append("\n\n");
            }

            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content",
                            "You are a literary translator. Translate the following English paragraphs into Russian. " +
                            "Each paragraph is numbered with [N]. " +
                            "Return ONLY the translated paragraphs in the same numbered format [N]."),
                    Map.of("role", "user", "content", textsToTranslate.toString())
            );

            String translationText = openAi.complete("gpt-4.1-mini", 8192, messages);

            Map<Integer, String> translationMap = new HashMap<>();
            for (String line : translationText.split("\n\n+")) {
                Matcher m = Pattern.compile("^\\[(\\d+)\\]\\s*([\\s\\S]+)").matcher(line.trim());
                if (m.find()) {
                    translationMap.put(Integer.parseInt(m.group(1)), m.group(2).trim());
                }
            }

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
            send(emitter, Map.of("progress", true, "translated", translated, "total", book.getTotalParagraphs(), "percent", pct));   // ← прогресс

            if (!isLast) {
                Thread.sleep(200);
            }
        }

        send(emitter, Map.of("done", true));   // ← конец
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

private void send(SseEmitter emitter, Map<String, Object> data) {
    try {
        emitter.send(SseEmitter.event().data(mapper.writeValueAsString(data)));
    } catch (Exception e) {
        // клиент закрыл соединение — игнорируем
    }
}
```

🧠 **Что нового:**

### `SseEmitter`

Это объект, держащий открытое HTTP-соединение. Спустя время метод вызовет `emitter.complete()` — соединение закроется.

### Helper `send`

```java
emitter.send(SseEmitter.event().data(mapper.writeValueAsString(data)));
```

- `mapper.writeValueAsString(data)` — Jackson сериализует `Map` в JSON.
- `SseEmitter.event().data(json)` — обёртка с полем `data:`.
- `emitter.send(...)` — реально шлёт.

### Try-catch на send

Если клиент закрыл вкладку — `send` бросит исключение. Молча проглатываем — потерять одно событие не страшно.

## 2. Меняем эндпоинт

В `BookController.java` импортируй:
```java
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
```

И **замени** метод `translate` на:

```java
@PostMapping("/books/{id}/translate")
public SseEmitter translate(
        @PathVariable Integer id,
        @RequestBody(required = false) Map<String, Object> body) {
    int batchSize = 8;
    if (body != null && body.get("batchSize") != null) {
        try { batchSize = Integer.parseInt(body.get("batchSize").toString()); } catch (Exception ignored) {}
    }
    SseEmitter emitter = new SseEmitter(300_000L);   // 5 минут таймаут
    translationService.translateBook(id, batchSize, emitter);
    return emitter;
}
```

🧠 Возвращаем `SseEmitter` напрямую — Spring сам поддерживает соединение и не закрывает его. `300_000L` — таймаут 5 минут (`L` означает `long`, подчёркивания в числе — для читаемости).

## ✅ Проверка

```bash
curl -N -X POST http://localhost:8080/books/6/translate -H 'Content-Type: application/json'
```

Флаг `-N` — не буферизировать вывод. Должны посыпаться события:
```
data: {"started":true,"total":7}

data: {"progress":true,"translated":7,"total":7,"percent":100}

data: {"done":true}
```

🎉 SSE работает!

## 🤔 Проверь себя

  1. Чем SSE отличается от WebSocket — когда какой выбирать?
  2. Что произойдёт с `SseEmitter`, если клиент закроет соединение?
  3. Почему важно вызывать `emitter.complete()` или `emitter.completeWithError()` в конце?

  <details>
  <summary>Мини-упражнение: проверь SSE из терминала</summary>

  У нас прогресс приходит **из самого** `POST /translate`, отдельного эндпоинта `/translate-progress` нет. Запусти и не закрывай соединение:

  ```bash
  curl -N -X POST http://localhost:8080/books/1/translate \
       -H 'Content-Type: application/json'
  ```

  Флаг `-N` отключает буферизацию `curl` — увидишь `data: {...}` по мере поступления, а не одним блоком в конце.
  </details>

  ## ➡️ Дальше

Осталась последняя крупная фича — словарь. [Шаг 20 — Таблица и сервис словаря →](20-словарь-сервис.md)
