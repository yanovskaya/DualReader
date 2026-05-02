# Глава 13. JdbcTemplate и вызов OpenAI

> **Зачем эта глава:** научиться работать с БД, когда JPA не справляется, и звать внешний API без сторонних библиотек.
> **Файлы проекта:**
> - `artifacts/api-server/src/main/java/com/lingua/api/service/DictionaryService.java`
> - `artifacts/api-server/src/main/java/com/lingua/api/service/OpenAiService.java`

---

## Часть 1. JdbcTemplate

### Когда JPA не подходит

JPA + Hibernate — мощно, но не всё умеет. Конкретный пример: PostgreSQL-массивы (`text[]`).

Наша таблица `dictionary_lookups` хранит:
- `translations text[]` — массив переводов,
- `synonyms text[]` — массив синонимов,
- `examples text[]` — массив примеров.

Сделать `@Entity` с `List<String>` для этих колонок — мучение (JPA по умолчанию хочет либо отдельную таблицу, либо JSON-колонку).

Поэтому для словаря мы используем **`JdbcTemplate`** — лёгкая обёртка над сырым JDBC.

### Подключение

```java
@Service
@RequiredArgsConstructor
public class DictionaryService {
    private final JdbcTemplate jdbc;
    private final OpenAiService openAi;
    private final ObjectMapper mapper = new ObjectMapper();
```

Spring **сам** создаст `JdbcTemplate` (на базе нашего `DataSource`) и подставит. Никаких бинов руками писать не надо.

### SELECT с маппером

```java
private static final RowMapper<Map<String, Object>> LOOKUP_MAPPER = (rs, rowNum) -> {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("word", rs.getString("word"));
    m.put("translations", toStringList(rs, "translations"));
    m.put("synonyms", toStringList(rs, "synonyms"));
    m.put("partOfSpeech", rs.getString("part_of_speech"));
    m.put("transcription", rs.getString("transcription"));
    m.put("examples", toStringList(rs, "examples"));
    m.put("exampleTranslations", toStringList(rs, "example_translations"));
    m.put("lookedUpAt", rs.getTimestamp("looked_up_at").toInstant().toString());
    return m;
};
```

`RowMapper<T>` — функция (одна строка ResultSet) → объект T. Здесь мы превращаем строку в `Map`.

`rs` — `ResultSet`, низкоуровневый объект с методами `getString("col")`, `getInt("col")`, `getTimestamp("col")`, `getArray("col")`.

`rowNum` — индекс строки (часто не нужен).

### Выполнение запроса

```java
List<Map<String, Object>> cached = jdbc.query(
        "SELECT * FROM dictionary_lookups WHERE word = ? ORDER BY looked_up_at DESC LIMIT 1",
        LOOKUP_MAPPER, normalizedWord);
```

- `?` — placeholder для параметра. **Безопасно** против SQL-инъекций.
- Параметры передаются после маппера в порядке `?`.
- Возвращается `List<T>`.

Другие методы:
- `jdbc.query(...)` — ноль или больше строк, возвращает `List`.
- `jdbc.queryForObject(...)` — ровно одна строка, возвращает один объект (бросит исключение, если 0 или >1).
- `jdbc.update(sql, params...)` — INSERT/UPDATE/DELETE, возвращает кол-во затронутых строк.

### Чтение PG-массива

```java
private static List<String> toStringList(ResultSet rs, String column) throws SQLException {
    Array arr = rs.getArray(column);
    if (arr == null) return new ArrayList<>();
    String[] strings = (String[]) arr.getArray();
    return strings != null ? Arrays.asList(strings) : new ArrayList<>();
}
```

`rs.getArray(...)` возвращает JDBC-обёртку. `arr.getArray()` — настоящий Java-массив.

### INSERT с массивами

Здесь обычный `jdbc.update(sql, ...)` не подойдёт — массивы нужно создавать особым способом. Используем `PreparedStatementCreator`:

```java
jdbc.update(con -> {
    var ps = con.prepareStatement(
            "INSERT INTO dictionary_lookups (word, translations, synonyms, part_of_speech, transcription, examples, example_translations) VALUES (?, ?, ?, ?, ?, ?, ?)");
    ps.setString(1, resultWord);
    ps.setArray(2, con.createArrayOf("text", translations.toArray(String[]::new)));
    ps.setArray(3, con.createArrayOf("text", synonyms.toArray(String[]::new)));
    ps.setString(4, partOfSpeech);
    ps.setString(5, transcription);
    ps.setArray(6, con.createArrayOf("text", examples.toArray(String[]::new)));
    ps.setArray(7, con.createArrayOf("text", exampleTranslations.toArray(String[]::new)));
    return ps;
});
```

- `con` — Connection из пула.
- `con.createArrayOf("text", String[])` — создать PG-массив `text[]`.
- `con.prepareStatement(sql)` — подготовленный SQL-запрос.
- `ps.setString(номер, значение)` — установить значение по индексу `?` (нумерация **с 1**, а не 0).
- `var` (Java 10+) — короткое объявление с выводом типа.

### Лямбда: `con -> { ... }`

Это лямбда, реализующая интерфейс `PreparedStatementCreator`. У него один метод — мы и реализуем его лямбдой.

---

## Часть 2. Вызов OpenAI без сторонних библиотек

Можно было взять `openai-java`-клиент. Но мы покажем, как это делается **руками** через стандартный `java.net.http.HttpClient` (есть с Java 11). Полезно понимать.

### Полный класс

```java
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

### Разбор

#### Конструктор

```java
public OpenAiService() {
    this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    this.apiKey = System.getenv("OPENAI_API_KEY");
}
```

- `HttpClient` создаётся **один раз** и переиспользуется (он thread-safe и держит пул соединений).
- Ключ читаем из переменной окружения **один раз** при старте.

#### Сборка тела запроса

```java
Map<String, Object> body = Map.of(
        "model", model,
        "max_completion_tokens", maxTokens,
        "messages", messages
);
String jsonBody = mapper.writeValueAsString(body);
```

`Map.of(...)` → JSON через Jackson.

#### Сборка HTTP-запроса

```java
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(API_URL))
        .timeout(Duration.ofSeconds(120))
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer " + apiKey)
        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
        .build();
```

Builder-паттерн: цепочка вызовов, в конце `.build()` возвращает готовый объект.

- `Authorization: Bearer <ключ>` — стандарт OpenAI.
- `BodyPublishers.ofString(...)` — превращает строку в тело запроса.

#### Отправка и парсинг ответа

```java
HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
```

`send` — **синхронный** (блокирующий) вызов. Есть и асинхронный `sendAsync`, возвращающий `CompletableFuture`.

`BodyHandlers.ofString()` — собрать ответ в строку.

#### Извлечение текста из ответа OpenAI

OpenAI возвращает примерно:
```json
{
  "choices": [
    { "message": { "role": "assistant", "content": "Здесь перевод" } }
  ]
}
```

Мы ныряем по уровням:
```java
Map<?, ?> parsed = mapper.readValue(response.body(), Map.class);
List<?> choices = (List<?>) parsed.get("choices");
Map<?, ?> first = (Map<?, ?>) choices.get(0);
Map<?, ?> message = (Map<?, ?>) first.get("message");
return String.valueOf(message.get("content"));
```

Тут много кастов (`(List<?>)` и т.д.) — потому что Jackson разбирает в `Map<String, Object>`, а внутри лежит что попало. В реальном проекте лучше сделать DTO-классы под ответ OpenAI:

```java
public record ChatResponse(List<Choice> choices) {}
public record Choice(Message message) {}
public record Message(String role, String content) {}

ChatResponse resp = mapper.readValue(response.body(), ChatResponse.class);
return resp.choices().get(0).message().content();
```

Это типобезопаснее.

### Обработка ошибок

```java
} catch (Exception e) {
    throw new RuntimeException("OpenAI API call failed: " + e.getMessage(), e);
}
```

Заворачиваем любое исключение в `RuntimeException` с понятным сообщением. Оригинал передаём как `cause` (вторым аргументом) — он будет в логах.

---

## Часть 3. Логика словаря целиком

### Алгоритм `lookup(word, context)`

```java
public Map<String, Object> lookup(String word, String context) {
    String normalizedWord = word.toLowerCase().trim();

    // 1. Проверяем кэш
    List<Map<String, Object>> cached = jdbc.query(
            "SELECT * FROM dictionary_lookups WHERE word = ? ORDER BY looked_up_at DESC LIMIT 1",
            LOOKUP_MAPPER, normalizedWord);

    if (!cached.isEmpty()) {
        Map<String, Object> entry = cached.get(0);
        List<?> synonyms = (List<?>) entry.get("synonyms");
        if (synonyms != null && !synonyms.isEmpty()) {
            // Хит кэша — обновляем timestamp и возвращаем
            jdbc.update("UPDATE dictionary_lookups SET looked_up_at = NOW() WHERE word = ? AND looked_up_at = (SELECT MAX(looked_up_at) FROM dictionary_lookups WHERE word = ?)",
                    normalizedWord, normalizedWord);
            entry.put("lookedUpAt", Instant.now().toString());
            return entry;
        }
    }
```

**Важная деталь:** возвращаем из кэша только если `synonyms` непустые. Это значит «запись из новой версии алгоритма» (старые записи без синонимов — игнорируем, идём к OpenAI).

```java
    // 2. Промт для OpenAI
    String contextHint = (context != null && !context.isBlank())
            ? "The word appears in this sentence: \"" + context + "\"\n..."
            : "";

    String systemPrompt = """
            You are an English–Russian dictionary. Respond ONLY with a JSON object — no markdown.
            ...
            """;

    List<Map<String, String>> messages = List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", "Word to look up: \"" + word + "\"\n" + contextHint)
    );
```

`"""..."""` — **text block** (Java 15+). Многострочная строка без необходимости escape-ить кавычки и переносы.

```java
    // 3. Зов OpenAI
    String content = openAi.complete("gpt-4.1-nano", 600, messages);
    content = content.replaceAll("```json\\n?|\\n?```", "").trim();
```

Иногда AI оборачивает ответ в ```` ```json ... ``` ```` — снимаем эту обёртку.

```java
    // 4. Парсим JSON-ответ
    Map<?, ?> ai;
    try {
        ai = mapper.readValue(content, Map.class);
    } catch (Exception e) {
        ai = Map.of("translations", List.of("перевод недоступен"), "examples", List.of());
    }
```

Если AI вернул мусор — fallback. Никаких 500 пользователю.

```java
    // 5. Сохраняем в кэш и возвращаем
    jdbc.update(con -> { ... });   // INSERT с массивами

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("word", resultWord);
    ...
    return result;
}
```

## Контрольные вопросы

1. Когда брать `JdbcTemplate` вместо JPA?
2. Что такое `RowMapper`?
3. Почему `setString(1, ...)` — нумерация с **1**, а не с 0?
4. Что такое text block (`"""..."""`)?
5. Какие плюсы у DTO-record вместо `Map<String, Object>` для парсинга ответа OpenAI?

## Мини-упражнение

Напиши метод в `DictionaryService`, который удаляет одну запись из кэша по слову.

<details>
<summary>Решение</summary>

```java
public int deleteByWord(String word) {
    return jdbc.update("DELETE FROM dictionary_lookups WHERE word = ?", word.toLowerCase().trim());
}
```

`update` для DELETE возвращает количество удалённых строк.
</details>

## Что дальше

Технический материал кончился. Теперь — **самое полезное**: пошаговый рецепт «как добавить свой эндпоинт с нуля». **[Глава 14 — Свой эндпоинт →](14-свой-эндпоинт.md)**
