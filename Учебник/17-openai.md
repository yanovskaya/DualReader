# Шаг 17. Сервис OpenAI

🎯 **Цель:** есть бин `OpenAiService.complete(...)`, который зовёт OpenAI Chat Completions API.

📁 **Файлы шага:**
- `src/main/java/com/lingua/api/service/OpenAiService.java` (новый)
- Установить переменную `OPENAI_API_KEY`

## Подготовка ключа

Получи API-ключ на https://platform.openai.com/api-keys и установи:

В Replit — добавь секрет `OPENAI_API_KEY` через панель Secrets. Локально:
```bash
export OPENAI_API_KEY="sk-..."
```

> Никогда не коммить ключ в git!

## 1. Сервис

Будем использовать **встроенный** `java.net.http.HttpClient` (есть с Java 11) — без сторонних библиотек.

Также пригодится `ObjectMapper` — он уже есть в Jackson (входит в `spring-boot-starter-web`).

**`src/main/java/com/lingua/api/service/OpenAiService.java`** (новый):

```java
package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class OpenAiService {

    private static final String API_URL = "https://api.openai.com/v1/chat/completions";
    private final HttpClient httpClient;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String apiKey;

    public OpenAiService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        this.apiKey = System.getenv("OPENAI_API_KEY");
    }

    public String complete(String model, int maxTokens, List<Map<String, String>> messages) {
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_completion_tokens", maxTokens,
                    "messages", messages
            );

            String jsonBody = mapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            Map<?, ?> parsed = mapper.readValue(response.body(), Map.class);
            List<?> choices = (List<?>) parsed.get("choices");
            if (choices == null || choices.isEmpty()) return "";
            Map<?, ?> first = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) first.get("message");
            return message == null ? "" : String.valueOf(message.get("content"));
        } catch (Exception e) {
            throw new RuntimeException("OpenAI API call failed: " + e.getMessage(), e);
        }
    }
}
```

🧠 **Разбор:**

### Конструктор

```java
public OpenAiService() {
    this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    this.apiKey = System.getenv("OPENAI_API_KEY");
}
```

- `HttpClient` создаём один раз — он thread-safe и сам пулит соединения.
- Ключ читаем при старте сервиса.

### Сборка тела

```java
Map<String, Object> body = Map.of(
        "model", model,
        "max_completion_tokens", maxTokens,
        "messages", messages
);
String jsonBody = mapper.writeValueAsString(body);
```

`Map.of(...)` → JSON через Jackson.

### Builder для HTTP-запроса

```java
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(API_URL))
        .timeout(Duration.ofSeconds(120))
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer " + apiKey)
        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
        .build();
```

Цепочка вызовов, в конце `.build()`. `Authorization: Bearer <key>` — стандарт OpenAI.

### Парсинг ответа

OpenAI возвращает:
```json
{
  "choices": [
    { "message": { "role": "assistant", "content": "..." } }
  ]
}
```

Мы ныряем по слоям через `(Map<?, ?>)` и `(List<?>)` касты. Не очень красиво, но работает без отдельного DTO.

## ✅ Проверка

Эндпоинта пока нет, но можно временно добавить тестовый. В **любой контроллер** временно:

```java
@org.springframework.beans.factory.annotation.Autowired
com.lingua.api.service.OpenAiService openAi;

@GetMapping("/test-ai")
public String testAi() {
    return openAi.complete("gpt-4.1-nano", 100, java.util.List.of(
        java.util.Map.of("role", "user", "content", "Say hello in Russian")
    ));
}
```

```bash
curl http://localhost:8080/test-ai
```

Должна вернуться строка с приветствием на русском. Если упало с `401 Unauthorized` — проверь, что `OPENAI_API_KEY` установлен и сервер видит его (перезапусти).

После проверки — **удали** временный эндпоинт, нам он не нужен.

## 🤔 Проверь себя

  1. Почему мы используем встроенный `java.net.http.HttpClient` вместо `RestTemplate`/`WebClient`?
  2. Зачем выносить `OPENAI_API_KEY` в переменную окружения, а не в `application.properties`?
  3. Зачем мы создаём один `HttpClient` в конструкторе и переиспользуем — что плохого было бы создавать новый на каждый запрос?

  <details>
  <summary>Мини-упражнение: сделай таймаут</summary>

  OpenAI может зависнуть на минуты. Добавь таймаут к запросу:

  ```java
  HttpRequest request = HttpRequest.newBuilder()
      .uri(URI.create(OPENAI_URL))
      .timeout(Duration.ofSeconds(60))
      .header(...)
      .POST(...)
      .build();
  ```

  Без `timeout` запрос может ждать вечно — и вместе с ним поток в твоём `@Async`-пуле.
  </details>

  ## ➡️ Дальше

Теперь сделаем фоновый перевод книги. [Шаг 18 — Фоновый перевод →](18-фоновый-перевод.md)
