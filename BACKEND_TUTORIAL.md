# Бэкенд Lingua — пошаговый разбор для начинающих

Этот документ — подробный туториал по тому, как устроен бэкенд **Lingua**. Прочитав его целиком, вы сможете объяснить каждую строчку кода в `artifacts/api-server/` и написать свой собственный аналогичный сервис.

Бэкенд написан на **Java 17** с использованием фреймворка **Spring Boot 3.2**. База данных — **PostgreSQL**.

---

## Оглавление

1. [Что такое Spring Boot и почему он](#1-что-такое-spring-boot-и-почему-он)
2. [Архитектура: слои приложения](#2-архитектура-слои-приложения)
3. [Структура папок](#3-структура-папок)
4. [`pom.xml` — что такое Maven и зависимости](#4-pomxml--что-такое-maven-и-зависимости)
5. [`application.properties` — настройки](#5-applicationproperties--настройки)
6. [Точка входа — `LinguaApiApplication.java`](#6-точка-входа--linguaapiapplicationjava)
7. [Конфигурация: подключение к БД, асинхронность, CORS](#7-конфигурация-подключение-к-бд-асинхронность-cors)
8. [Модели (Entity) — таблицы как Java-классы](#8-модели-entity--таблицы-как-java-классы)
9. [Репозитории — работа с БД без SQL](#9-репозитории--работа-с-бд-без-sql)
10. [Сервисы — бизнес-логика](#10-сервисы--бизнес-логика)
11. [Контроллеры — HTTP-эндпоинты](#11-контроллеры--http-эндпоинты)
12. [Особые приёмы: SSE, MultipartFile, JdbcTemplate, парсинг EPUB](#12-особые-приёмы)
13. [Как добавить свой эндпоинт — пример с нуля](#13-как-добавить-свой-эндпоинт--пример-с-нуля)
14. [Глоссарий аннотаций Spring](#14-глоссарий-аннотаций-spring)

---

## 1. Что такое Spring Boot и почему он

**Spring** — это огромный фреймворк для Java, делающий за вас всю «обвязку»: запуск веб-сервера, парсинг JSON, подключение к БД, обработка HTTP, безопасность и т.д.

**Spring Boot** — обёртка вокруг Spring, которая всё это автоматически настраивает по умолчанию. Вы пишете только бизнес-логику.

Ключевая идея — **Inversion of Control (IoC)** и **Dependency Injection (DI)**:

> Вы НЕ создаёте объекты сами через `new`. Вы говорите Spring: «вот класс, он мне нужен» — Spring сам его создаёт и подсовывает в нужное место.

Эти «созданные Spring'ом объекты» называются **бинами** (beans). Spring хранит их в контейнере под названием **ApplicationContext**.

Пример. Вместо:
```java
BookService service = new BookService(new BookRepository(...), new ParagraphRepository(...));
```
Вы пишете просто:
```java
@Service
public class BookService {
    private final BookRepository bookRepo;       // Spring сам подставит
    private final ParagraphRepository paragraphRepo; // Spring сам подставит
}
```
И Spring при старте сам найдёт все классы с аннотациями `@Service`, `@Repository`, `@Controller`, создаст их и связает между собой.

---

## 2. Архитектура: слои приложения

Это классический трёхслойный подход:

```
┌─────────────────────────────────────────────────────┐
│  Controller   (HTTP — принимает запросы, отдаёт JSON)
│      ↓
│  Service      (бизнес-логика — что и как делать)
│      ↓
│  Repository   (работа с БД — SELECT / INSERT / UPDATE)
│      ↓
│  Database     (PostgreSQL)
└─────────────────────────────────────────────────────┘
```

Правила:
- **Controller** не лезет в БД напрямую и не знает про SQL. Он только принимает запрос, валидирует параметры и зовёт сервис.
- **Service** не знает про HTTP. Он содержит бизнес-логику и зовёт репозитории.
- **Repository** ничего не знает кроме одной таблицы.

Зачем так? Потому что каждый слой можно менять и тестировать отдельно.

---

## 3. Структура папок

```
artifacts/api-server/
├── pom.xml                           ← конфигурация Maven (зависимости, сборка)
├── src/main/
│   ├── resources/
│   │   └── application.properties    ← настройки приложения (порт, БД, лимиты)
│   └── java/com/lingua/api/
│       ├── LinguaApiApplication.java ← точка входа (метод main)
│       ├── config/                   ← классы конфигурации (DataSource, CORS, Async)
│       ├── controller/               ← HTTP-эндпоинты
│       ├── service/                  ← бизнес-логика
│       ├── repository/               ← интерфейсы для работы с БД
│       └── model/                    ← Java-классы, отображающие таблицы БД
```

**Важно про package** (`com.lingua.api`): это уникальное имя проекта (как обратное доменное имя). Папки на диске должны 1-в-1 повторять package: `com/lingua/api/`. Это требование Java.

---

## 4. `pom.xml` — что такое Maven и зависимости

**Maven** — менеджер зависимостей (как npm для JavaScript). Файл `pom.xml` (Project Object Model) описывает:
1. Что это за проект (группа, артефакт, версия).
2. Какие библиотеки нужны.
3. Как его собирать.

Разберём наш `pom.xml`:

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.5</version>
</parent>
```
Мы наследуем «родительский» POM от Spring Boot. Он уже содержит проверенные версии сотен библиотек, чтобы они не конфликтовали. Это называется **dependency management**.

```xml
<groupId>com.lingua</groupId>
<artifactId>lingua-api-server</artifactId>
<version>0.0.1-SNAPSHOT</version>
```
Это «координаты» НАШЕГО проекта. `SNAPSHOT` означает «версия в разработке».

```xml
<properties>
    <java.version>17</java.version>
</properties>
```
Используем Java 17.

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
```
**Starter'ы** — это пакеты-«стартеры», которые тянут пачку библиотек разом.
- `spring-boot-starter-web` → веб-сервер Tomcat + Spring MVC + Jackson (JSON).
- `spring-boot-starter-data-jpa` → JPA + Hibernate + JDBC + HikariCP (пул соединений).
- `spring-boot-starter-actuator` → готовые эндпоинты для мониторинга (`/actuator/health`).

```xml
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```
JDBC-драйвер для PostgreSQL. `scope=runtime` означает «не нужен при компиляции, нужен только при запуске».

```xml
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
```
**Lombok** — библиотека, которая через аннотации `@Data`, `@RequiredArgsConstructor` генерирует геттеры/сеттеры/конструкторы за вас прямо во время компиляции. Без неё пришлось бы писать кучу boilerplate-кода.

---

## 5. `application.properties` — настройки

Это файл свойств в формате `ключ=значение`, который Spring Boot автоматически загружает.

```properties
server.port=${PORT:8080}
```
Порт сервера. Запись `${PORT:8080}` означает: «возьми переменную окружения `PORT`, а если её нет — используй `8080`».

```properties
server.servlet.context-path=/api
```
Префикс ко всем URL. Если контроллер объявлен как `/books`, реальный путь будет `/api/books`.

```properties
spring.jpa.hibernate.ddl-auto=none
```
Hibernate не должен сам создавать/менять таблицы. Схему БД мы держим в Drizzle (отдельно). `none` — самый безопасный вариант для продакшена.

```properties
spring.jpa.open-in-view=false
```
Отключает «лениво загружать данные из БД во время рендеринга ответа». Без этого можно нечаянно сделать кучу лишних запросов.

```properties
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB
```
Лимит загружаемого файла — 50 МБ.

```properties
logging.level.com.lingua=INFO
```
Уровень логов для нашего пакета: показывать INFO и выше (`INFO`, `WARN`, `ERROR`). Для отладки можно поставить `DEBUG`.

---

## 6. Точка входа — `LinguaApiApplication.java`

```java
package com.lingua.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class LinguaApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(LinguaApiApplication.class, args);
    }
}
```

Разбор по строкам:

- `@SpringBootApplication` — комбо-аннотация, объединяющая три:
  - `@Configuration` (этот класс может объявлять бины),
  - `@EnableAutoConfiguration` (включи автонастройку Spring Boot),
  - `@ComponentScan` (просканируй текущий пакет и подпакеты в поисках классов с `@Service`, `@Controller` и т.д.).
- `@EnableAsync` — разрешает использовать аннотацию `@Async` для запуска методов в фоне (нужно для перевода).
- `SpringApplication.run(...)` — запускает приложение: поднимает встроенный Tomcat, создаёт ApplicationContext, инициализирует все бины.

**Это всё.** Файл из 13 строк запускает весь сервер.

---

## 7. Конфигурация: подключение к БД, асинхронность, CORS

### 7.1 `DatabaseConfig.java` — пул соединений с БД

Spring Boot обычно сам создаёт DataSource из `spring.datasource.url`. Но у нас особенность: переменная `DATABASE_URL` приходит в формате `postgres://user:pass@host:port/db` (так Heroku/Replit любят), а JDBC требует `jdbc:postgresql://...`. Поэтому конвертируем вручную:

```java
@Configuration
public class DatabaseConfig {

    @Bean
    @Primary
    public DataSource dataSource() throws Exception {
        String dbUrl = System.getenv("DATABASE_URL");
```
- `@Configuration` — класс с настройками для Spring.
- `@Bean` — метод производит бин. Spring вызовет его один раз и сохранит результат, потом будет раздавать всем, кому нужен `DataSource`.
- `@Primary` — если есть несколько `DataSource`, выбирай этот.

```java
        if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
            URI uri = new URI(dbUrl);
            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String path = uri.getPath().replaceFirst("^/", "");
            String userInfo = uri.getUserInfo();
```
Парсим URL стандартным `java.net.URI`. Пользователь и пароль — в `userInfo`, разделены двоеточием.

```java
            dbUrl = String.format("jdbc:postgresql://%s:%d/%s", host, port, path);

            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(dbUrl);
            config.setUsername(user);
            config.setPassword(password);
            config.setMaximumPoolSize(10);
```
**HikariCP** — самый быстрый пул соединений на JVM. Вместо открытия соединения с БД на каждый запрос (что медленно) пул держит 10 уже открытых соединений и переиспользует их.

### 7.2 `AsyncConfig.java` — пул потоков для фоновых задач

```java
@Bean(name = "translationExecutor")
public Executor translationExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);    // постоянно держим 4 потока
    executor.setMaxPoolSize(8);     // можем доходить до 8 при нагрузке
    executor.setQueueCapacity(50);  // если все потоки заняты — копим до 50 задач в очереди
    executor.setThreadNamePrefix("translation-");
    executor.initialize();
    return executor;
}
```
Это пул для перевода. Когда мы пометим метод как `@Async("translationExecutor")` — он будет выполняться в одном из этих потоков, а HTTP-запрос вернётся пользователю мгновенно.

### 7.3 `CorsConfig.java` — разрешаем запросы с других доменов

Браузер блокирует запросы с одного домена на другой по умолчанию. CORS — стандарт для разрешения этого.

```java
registry.addMapping("/**")
        .allowedOriginPatterns("*")    // любые домены
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .allowCredentials(false);
```

---

## 8. Модели (Entity) — таблицы как Java-классы

**JPA** (Java Persistence API) — стандарт ORM в Java. **Hibernate** — конкретная реализация.

ORM = Object-Relational Mapping. Идея: каждой таблице БД соответствует Java-класс, каждой колонке — поле.

### `Book.java`

```java
@Entity                       // это сущность (= таблица)
@Table(name = "books")        // имя таблицы
@Data                         // Lombok: сгенерируй геттеры, сеттеры, equals, hashCode, toString
@NoArgsConstructor            // Lombok: пустой конструктор (требуется JPA)
public class Book {

    @Id                                              // первичный ключ
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // авто-инкремент в БД
    private Integer id;

    @Column(nullable = false)                        // NOT NULL в БД
    private String title;

    private String author;                           // обычная строковая колонка

    @Column(name = "total_paragraphs", nullable = false)   // имя колонки в БД отличается от имени поля
    private int totalParagraphs = 0;
```

Особый случай — PostgreSQL ENUM:

```java
@Column(name = "translation_status", columnDefinition = "translation_status")
private String translationStatus = "pending";
```
В БД есть тип `CREATE TYPE translation_status AS ENUM (...)`. JPA по умолчанию не умеет с ним работать, поэтому мы:
- объявляем поле как `String`,
- через `columnDefinition` говорим: «эта колонка имеет тип `translation_status` в БД».

### `Paragraph.java`

Аналогично — таблица абзацев. Обратите внимание:

```java
@Column(name = "is_translated", nullable = false)
private boolean isTranslated = false;
```

---

## 9. Репозитории — работа с БД без SQL

**Spring Data JPA** — магия. Вы создаёте интерфейс, и Spring сам пишет реализацию во время старта.

### `BookRepository.java`

```java
@Repository
public interface BookRepository extends JpaRepository<Book, Integer> {
    List<Book> findAllByOrderByCreatedAtAsc();

    @Query(value = "SELECT SUM(...) FROM paragraphs WHERE book_id = :bookId", nativeQuery = true)
    Long countWordsByBookId(Integer bookId);
}
```

Что мы получили **бесплатно**, наследуясь от `JpaRepository<Book, Integer>` (где `Book` — сущность, `Integer` — тип ID):
- `save(book)` — INSERT или UPDATE.
- `findById(id)` — SELECT по ID.
- `findAll()` — SELECT всех.
- `deleteById(id)` — DELETE.
- `count()`, `existsById(id)` и т.д.

**Производные методы (derived queries)** — Spring парсит ИМЯ метода и сам составляет SQL:
- `findAllByOrderByCreatedAtAsc()` → `SELECT * FROM books ORDER BY created_at ASC`.
- `findByBookIdAndIsTranslatedFalseOrderByPosition(bookId)` → `WHERE book_id = ? AND is_translated = false ORDER BY position`.

Грамматика: `find` / `count` / `delete` + `By` + `<имя поля>` + `<условие>` + `OrderBy<Поле><Asc|Desc>`.

**`@Query`** — когда производное имя становится слишком длинным или нужен сложный SQL:
- `nativeQuery = true` → пишем чистый SQL.
- Без `nativeQuery` — пишем JPQL (язык запросов JPA, оперирует именами классов и полей, а не таблиц и колонок).

Пример JPQL из `ParagraphRepository`:
```java
@Query("SELECT p FROM Paragraph p WHERE p.bookId = :bookId AND " +
       "(LOWER(p.originalText) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
       "LOWER(p.translatedText) LIKE LOWER(CONCAT('%', :q, '%'))) " +
       "ORDER BY p.position")
List<Paragraph> searchByBookId(Integer bookId, String q, Pageable pageable);
```
- `:bookId`, `:q` — именованные параметры, подставятся из аргументов метода.
- `Pageable` — спец-параметр Spring Data, поддерживающий пагинацию (LIMIT/OFFSET).

---

## 10. Сервисы — бизнес-логика

Сервис — слой, который комбинирует репозитории и решает «что делать».

### `BookService.java` — фрагменты

```java
@Service
@RequiredArgsConstructor
public class BookService {

    private final BookRepository bookRepo;
    private final ParagraphRepository paragraphRepo;
```
- `@Service` — пометка, что класс — бин-сервис. Spring создаст его при старте.
- `@RequiredArgsConstructor` (Lombok) — генерирует конструктор со ВСЕМИ `final`-полями. Spring передаст в этот конструктор уже созданные `BookRepository` и `ParagraphRepository`. Это и есть **constructor-based dependency injection** — рекомендованный способ DI.

```java
@Transactional
public Book createBook(String title, String author, String language, String content) {
    List<String> rawParagraphs = Arrays.stream(content.split("\n\n+"))
            .map(String::trim)
            .filter(p -> p.length() > 10)
            .toList();

    Book book = new Book();
    book.setTitle(title);
    ...
    bookRepo.save(book);

    insertParagraphBatch(book.getId(), rawParagraphs);
    return book;
}
```
Здесь:
- `@Transactional` — весь метод выполняется в **одной транзакции БД**. Если в середине упадёт исключение — все изменения откатятся (rollback). Без этой аннотации можно создать книгу, упасть на абзацах и оставить «осиротевшую» книгу в БД.
- Stream API: `split` → `trim` → отфильтровать слишком короткие → собрать обратно в список.
- `bookRepo.save(book)` после возврата заполнит `book.getId()` сгенерированным значением.

```java
private void insertParagraphBatch(Integer bookId, List<String> texts) {
    List<Paragraph> batch = new ArrayList<>();
    for (int i = 0; i < texts.size(); i++) {
        Paragraph p = new Paragraph();
        ...
        batch.add(p);
        if (batch.size() == 200) {
            paragraphRepo.saveAll(batch);
            batch.clear();
        }
    }
    if (!batch.isEmpty()) paragraphRepo.saveAll(batch);
}
```
**Батчинг** — вместо 1000 отдельных INSERT'ов отправляем по 200 за раз. Это в разы быстрее.

### Как методы сервиса связаны с эндпоинтами

| Эндпоинт | Метод сервиса |
|---|---|
| `GET /books` | `listBooks()` |
| `POST /books` | `createBook(...)` |
| `GET /books/:id/paragraphs` | `getParagraphs(...)` |
| `GET /books/:id/chapters` | `getChapters(...)` |
| `GET /books/:id/search` | `search(...)` |
| `GET /books/:id/stats` | `getStats(...)` |

### Распознавание заголовков глав — `isHeading`

```java
public static boolean isHeading(String text) {
    String t = text.trim();
    if (t.length() > 120) return false;
    if (Pattern.compile("^\\d+\\.\\s+\\S").matcher(t).find()) return true;
    if (Pattern.compile("^(chapter|part|section|prologue|...)\\b", CASE_INSENSITIVE).matcher(t).find()) return true;
    if (Pattern.compile("^[IVXLCDM]+\\.?\\s*$").matcher(t).matches()) return true;
    if (t.length() <= 60 && t.equals(t.toUpperCase()) && Pattern.compile("^[A-Z][A-Z\\s\\d'\"\\-]{2,}$").matcher(t).matches()) return true;
    return false;
}
```
Проверяем по очереди:
1. Длинный текст (> 120 символов) — не заголовок.
2. `1. Что-то` — заголовок.
3. Начинается со слов `Chapter`, `Part`, `Prologue` и т.д. — заголовок.
4. Римская цифра отдельной строкой (`II`, `IV`).
5. Короткая строка ВСЯ В ВЕРХНЕМ РЕГИСТРЕ.

---

## 11. Контроллеры — HTTP-эндпоинты

### `HealthController.java` — самый простой пример

```java
@RestController
public class HealthController {
    @GetMapping("/healthz")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
```
- `@RestController` = `@Controller` + `@ResponseBody`. Каждый метод возвращает JSON напрямую (не имя HTML-шаблона).
- `@GetMapping("/healthz")` — реагируй на `GET /healthz`.
- `ResponseEntity` — обёртка, позволяющая задать и тело ответа, и HTTP-статус, и заголовки.
- `Map.of(...)` Jackson сериализует в `{"status":"ok"}`.

### `BookController.java` — разбор основных приёмов

```java
@RestController
@RequiredArgsConstructor
public class BookController {

    private final BookService bookService;
    private final TranslationService translationService;
    private final ParagraphRepository paragraphRepo;
```
То же DI, что и в сервисе.

#### Чтение path-параметра и query-параметров:
```java
@GetMapping("/books/{id}/paragraphs")
public ResponseEntity<?> getParagraphs(
        @PathVariable Integer id,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize) {
```
- `@PathVariable Integer id` — берёт `{id}` из URL и парсит в `Integer`.
- `@RequestParam(defaultValue = "1") int page` — query-параметр `?page=...`. Если не передан — будет `1`.

#### Чтение JSON-тела запроса:
```java
@PostMapping("/books")
public ResponseEntity<?> createBook(@RequestBody Map<String, Object> body) {
    String title = (String) body.get("title");
```
- `@RequestBody` — Jackson распарсит JSON в указанный тип. Здесь — в `Map`. Можно было бы сделать DTO-класс с полями.

#### Возврат разных HTTP-статусов:
```java
if (title == null || title.isBlank()) {
    return ResponseEntity.badRequest().body(Map.of("error", "title is required"));
}
...
return ResponseEntity.status(201).body(bookToMap(book));
```
- `badRequest()` → 400.
- `status(201)` → произвольный код.
- `noContent()` → 204.
- `notFound()` → 404.

#### Optional + map (функциональный стиль):
```java
return bookService.getBook(id)
        .map(b -> ResponseEntity.ok(bookToMap(b)))
        .orElse(ResponseEntity.notFound().build());
```
Это чище, чем `if (book.isPresent()) ... else ...`.

---

## 12. Особые приёмы

### 12.1 SSE — Server-Sent Events для перевода

SSE — это поток текстовых событий по HTTP, по которому сервер шлёт клиенту обновления в одну сторону. Идеален для прогресс-бара перевода.

```java
@PostMapping("/books/{id}/translate")
public SseEmitter translate(@PathVariable Integer id, ...) {
    SseEmitter emitter = new SseEmitter(300_000L);  // таймаут 5 минут
    translationService.translateBook(id, batchSize, emitter);
    return emitter;
}
```
Возвращаем `SseEmitter` — Spring сам поддержит соединение открытым. Внутри `translateBook` шлём данные:

```java
@Async("translationExecutor")
public void translateBook(Integer bookId, int batchSize, SseEmitter emitter) {
    ...
    send(emitter, Map.of("started", true, "total", untranslated.size()));
    ...
    for (int i = 0; i < untranslated.size(); i += batchSize) {
        // переводим батч через OpenAI
        // сохраняем в БД
        send(emitter, Map.of("progress", true, "translated", translated, ...));
    }
    send(emitter, Map.of("done", true));
    emitter.complete();
}

private void send(SseEmitter emitter, Map<String, Object> data) {
    emitter.send(SseEmitter.event().data(mapper.writeValueAsString(data)));
}
```

Ключевое:
- `@Async("translationExecutor")` — метод запустится в фоновом потоке из нашего пула. HTTP-запрос вернёт `SseEmitter` мгновенно, а перевод пойдёт в фоне, отправляя события в этот же эмиттер.
- `emitter.complete()` закрывает соединение в конце.

### 12.2 Загрузка файлов — `MultipartFile`

```java
@PostMapping("/books/upload")
public ResponseEntity<?> upload(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "title", required = false) String customTitle) {

    byte[] bytes = file.getBytes();
    String name = file.getOriginalFilename();
    String type = file.getContentType();
```
`MultipartFile` — обёртка Spring над загруженным файлом. Достаёте байты, имя, MIME-тип.

### 12.3 `JdbcTemplate` — когда JPA не справляется

JPA плохо умеет с PostgreSQL-массивами `text[]` (которые мы используем в таблице `dictionary_lookups`). Spring предлагает альтернативу — `JdbcTemplate`, тонкую обёртку над JDBC.

```java
@Service
@RequiredArgsConstructor
public class DictionaryService {
    private final JdbcTemplate jdbc;
```
Spring сам создаст `JdbcTemplate` (на базе нашего `DataSource`) и подставит его.

#### SELECT с маппером:

```java
private static final RowMapper<Map<String, Object>> LOOKUP_MAPPER = (rs, rowNum) -> {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("word", rs.getString("word"));
    m.put("translations", toStringList(rs, "translations"));
    ...
};

List<Map<String, Object>> cached = jdbc.query(
        "SELECT * FROM dictionary_lookups WHERE word = ? ORDER BY looked_up_at DESC LIMIT 1",
        LOOKUP_MAPPER, normalizedWord);
```
`?` — placeholder, `normalizedWord` подставится. `RowMapper` вызывается для каждой строки результата.

#### Чтение PG-массива:
```java
Array arr = rs.getArray("translations");
String[] strings = (String[]) arr.getArray();
```

#### INSERT с массивами:
```java
jdbc.update(con -> {
    var ps = con.prepareStatement(
            "INSERT INTO dictionary_lookups (word, translations, ...) VALUES (?, ?, ...)");
    ps.setString(1, resultWord);
    ps.setArray(2, con.createArrayOf("text", translations.toArray(String[]::new)));
    ...
    return ps;
});
```
Здесь мы получаем сырое JDBC-соединение, чтобы создать массив через `createArrayOf("text", ...)` — стандартного JPA-способа для этого нет.

### 12.4 Вызов OpenAI без сторонних библиотек

В `OpenAiService.java` мы используем встроенный `java.net.http.HttpClient` (появился в Java 11):

```java
HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.openai.com/v1/chat/completions"))
        .timeout(Duration.ofSeconds(120))
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer " + apiKey)
        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
        .build();

HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
```

Никаких внешних зависимостей. Тело — JSON, который мы собираем через `ObjectMapper` (Jackson).

### 12.5 Парсинг EPUB — это просто ZIP с XML

EPUB — это .zip-архив, внутри которого:
- `META-INF/container.xml` — указывает на главный файл.
- `*.opf` — манифест: список файлов и порядок чтения.
- `*.html` / `*.xhtml` — собственно содержание.

Алгоритм в `EpubParser.java`:
1. Открываем архив через `ZipInputStream`, читаем все файлы в `Map<String, byte[]>`.
2. Находим `.opf`-файл, парсим из него:
   - заголовок книги (`<dc:title>`),
   - манифест (id → href),
   - порядок чтения (`<spine>`).
3. Идём по spine, для каждого HTML — вырезаем теги, заменяем `<p>` и `<br>` на переносы строк, расшифровываем `&amp;`, `&lt;` и т.д.
4. Склеиваем всё в один большой текст.

Парсинг XML регулярками — некрасиво, но для EPUB достаточно (можно было бы взять библиотеку типа Jsoup).

---

## 13. Как добавить свой эндпоинт — пример с нуля

Допустим, мы хотим эндпоинт **`GET /books/:id/random-paragraph`** — отдаёт случайный абзац.

#### Шаг 1. Метод в репозитории

В `ParagraphRepository.java`:
```java
@Query(value = "SELECT * FROM paragraphs WHERE book_id = :bookId ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
Paragraph findRandomByBookId(Integer bookId);
```

#### Шаг 2. Метод в сервисе

В `BookService.java`:
```java
public Optional<Paragraph> getRandomParagraph(Integer bookId) {
    return Optional.ofNullable(paragraphRepo.findRandomByBookId(bookId));
}
```

#### Шаг 3. Эндпоинт в контроллере

В `BookController.java`:
```java
@GetMapping("/books/{id}/random-paragraph")
public ResponseEntity<?> randomParagraph(@PathVariable Integer id) {
    if (bookService.getBook(id).isEmpty()) {
        return ResponseEntity.notFound().build();
    }
    return bookService.getRandomParagraph(id)
            .map(p -> ResponseEntity.ok(bookService.paragraphToMap(p)))
            .orElse(ResponseEntity.notFound().build());
}
```

#### Шаг 4. Перезапустить сервер и проверить

```bash
curl localhost:80/api/books/2/random-paragraph
```

Готово — три файла, ~10 строк кода.

---

## 14. Глоссарий аннотаций Spring

| Аннотация | На чём используется | Что делает |
|---|---|---|
| `@SpringBootApplication` | Главный класс | Запускает Spring Boot |
| `@Configuration` | Класс | Содержит `@Bean`-методы |
| `@Bean` | Метод в `@Configuration` | Регистрирует возвращаемый объект как бин |
| `@Component` | Класс | Делает класс бином (общая аннотация) |
| `@Service` | Класс | То же, что `@Component`, но семантически — «бизнес-логика» |
| `@Repository` | Интерфейс / класс | То же + перевод исключений БД в Spring-стиль |
| `@RestController` | Класс | Контроллер, отвечающий JSON |
| `@RequestMapping("/path")` | Класс / метод | Базовый путь |
| `@GetMapping`, `@PostMapping`, `@DeleteMapping`, `@PutMapping` | Метод | HTTP-методы + путь |
| `@PathVariable` | Параметр метода | Берёт переменную из URL `{id}` |
| `@RequestParam` | Параметр метода | Берёт query-параметр `?key=value` |
| `@RequestBody` | Параметр метода | Парсит тело запроса (JSON) |
| `@Async("executorName")` | Метод | Запустить в фоне в указанном пуле |
| `@EnableAsync` | Главный класс | Включает поддержку `@Async` |
| `@Transactional` | Метод сервиса | Транзакция БД на весь метод |
| `@Entity` | Класс | JPA-сущность |
| `@Table(name="...")` | Класс | Имя таблицы |
| `@Id` | Поле | Первичный ключ |
| `@GeneratedValue` | Поле | Авто-генерация значения |
| `@Column(name="...", nullable=...)` | Поле | Описание колонки |
| `@Query("...")` | Метод репозитория | Кастомный SQL/JPQL |
| `@Data` (Lombok) | Класс | Геттеры, сеттеры, equals, hashCode, toString |
| `@RequiredArgsConstructor` (Lombok) | Класс | Конструктор со всеми `final`-полями |
| `@NoArgsConstructor` (Lombok) | Класс | Пустой конструктор |
| `@Primary` | Бин | Этот бин — основной, если их несколько |

---

## Что почитать дальше

1. **Официальный гайд Spring**: https://spring.io/guides/gs/rest-service/ — построить свой первый REST-сервис за 15 минут.
2. **Baeldung** (https://www.baeldung.com/) — лучший сайт с практическими статьями про Spring.
3. **Spring Data JPA reference**: https://docs.spring.io/spring-data/jpa/docs/current/reference/html/ — особенно раздел про derived queries.
4. **Книга**: «Spring in Action» (Craig Walls, 6th edition) — лучший учебник по Spring.

---

## Финальный совет

Самый быстрый путь научиться — **сделать своё**. Возьмите простую идею (например, REST-сервис для списка задач или дневник тренировок), скопируйте структуру папок этого проекта, и поэтапно повторите все 11 разделов на своих сущностях. Через 2–3 проекта Spring Boot перестанет казаться магией.
