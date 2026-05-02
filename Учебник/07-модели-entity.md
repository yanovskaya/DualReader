# Глава 07. Модели (Entity)

> **Зачем эта глава:** научиться превращать таблицы БД в Java-классы.
> **Файлы проекта:**
> - `artifacts/api-server/src/main/java/com/lingua/api/model/Book.java`
> - `artifacts/api-server/src/main/java/com/lingua/api/model/Paragraph.java`

## Что такое ORM

**ORM** = Object-Relational Mapping = «отображение объектов на реляционную БД».

Идея проста:
- В БД есть таблица `books` с колонками `id`, `title`, `author`.
- В Java есть класс `Book` с полями `id`, `title`, `author`.
- ORM «связывает» одно с другим: `book.title` ↔ строка в `books.title`.

Программист работает с объектами `Book` — а ORM сам генерирует SQL `SELECT`, `INSERT`, `UPDATE`.

В мире Java стандарт ORM — **JPA** (Java Persistence API). Самая популярная реализация JPA — **Hibernate**.

> Spring Data JPA, который мы используем, надстройка над JPA: дополнительно даёт магические репозитории (об этом — следующая глава).

## Модель `Book`

Полный код:

```java
package com.lingua.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "books")
@Data
@NoArgsConstructor
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String title;

    private String author;

    @Column(nullable = false)
    private String language = "en";

    @Column(name = "total_paragraphs", nullable = false)
    private int totalParagraphs = 0;

    @Column(name = "translated_paragraphs", nullable = false)
    private int translatedParagraphs = 0;

    @Column(name = "translation_status", columnDefinition = "translation_status")
    private String translationStatus = "pending";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
```

### Разбор: аннотации класса

```java
@Entity
```
«Этот класс — JPA-сущность». Hibernate будет считать его привязанным к таблице.

```java
@Table(name = "books")
```
Имя таблицы. Если не указать — Hibernate возьмёт имя класса (`Book` → `book`). Поскольку у нас в БД `books`, явно указываем.

```java
@Data
```
**Аннотация Lombok.** Во время компиляции добавит:
- геттер для каждого поля (`getTitle()`, `getId()` и т.д.),
- сеттер (`setTitle(String)`),
- метод `equals()`,
- метод `hashCode()`,
- метод `toString()`.

Без неё пришлось бы написать ~80 строк boilerplate-кода.

```java
@NoArgsConstructor
```
Тоже Lombok. Создаёт пустой конструктор `public Book() {}`. **Обязателен для JPA** — Hibernate сам создаёт объекты при загрузке из БД, и ему нужен пустой конструктор.

### Разбор: поля

```java
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
```
- `@Id` — это поле первичный ключ (PRIMARY KEY).
- `@GeneratedValue(IDENTITY)` — БД сама сгенерирует значение (это стандартный auto-increment в PostgreSQL).
- При вызове `bookRepo.save(book)` Hibernate выполнит `INSERT`, получит сгенерированный ID и автоматически положит его в `book.id`.

```java
    @Column(nullable = false)
    private String title;
```
- `@Column(nullable = false)` — соответствует `NOT NULL` в SQL. Hibernate проверит это перед `INSERT`.

```java
    private String author;
```
Без `@Column` — Hibernate возьмёт имя поля (`author`) и считает его именем колонки. Можно ничего не указывать, если имя совпадает.

```java
    @Column(name = "total_paragraphs", nullable = false)
    private int totalParagraphs = 0;
```
В Java принято **camelCase** (`totalParagraphs`). В SQL — **snake_case** (`total_paragraphs`). Поэтому явно мапим.

> 💡 Можно настроить Hibernate, чтобы он сам делал `camelCase → snake_case`. Но в нашем коде сделано вручную для ясности.

`= 0` — значение по умолчанию для нового объекта.

### Особый случай — PostgreSQL ENUM

```java
    @Column(name = "translation_status", columnDefinition = "translation_status")
    private String translationStatus = "pending";
```

В нашей БД есть тип `CREATE TYPE translation_status AS ENUM ('pending', 'in_progress', 'completed', 'failed')`. JPA из коробки не знает, как с ним работать.

Решение: объявить поле как `String`, а `columnDefinition = "translation_status"` говорит: «эта колонка имеет тип `translation_status`». При INSERT Hibernate подставит строку, а PG сам валидирует.

### Дата

```java
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
```
- `Instant` — современный Java-класс для UTC-меток времени. Используй его, не `java.util.Date`.
- `updatable = false` — Hibernate **никогда** не обновит эту колонку. Только при INSERT.
- `Instant.now()` — значение по умолчанию = «сейчас».

## Модель `Paragraph`

```java
@Entity
@Table(name = "paragraphs")
@Data
@NoArgsConstructor
public class Paragraph {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "book_id", nullable = false)
    private Integer bookId;

    @Column(nullable = false)
    private int position;

    @Column(name = "original_text", nullable = false, columnDefinition = "text")
    private String originalText;

    @Column(name = "translated_text", columnDefinition = "text")
    private String translatedText;

    @Column(name = "is_translated", nullable = false)
    private boolean isTranslated = false;
}
```

Аналогично. Обрати внимание:

```java
    @Column(name = "original_text", nullable = false, columnDefinition = "text")
    private String originalText;
```
`columnDefinition = "text"` нужен потому, что по умолчанию JPA создаёт `VARCHAR(255)` — а у нас могут быть длинные абзацы.

```java
    @Column(name = "is_translated", nullable = false)
    private boolean isTranslated = false;
```
В Java для логических — `boolean`. В БД — обычно `BOOLEAN`. Hibernate автоматически конвертирует.

## А где связи между таблицами?

В классическом JPA пишут так:
```java
@ManyToOne
@JoinColumn(name = "book_id")
private Book book;
```
То есть «у параграфа есть ссылка на книгу как на объект».

Но это удобно не всегда: тащит лишние JOIN, мешает оптимизировать. **Мы намеренно** держим `bookId` как простое `Integer` — это проще и быстрее. Связи проверяем вручную в сервисах.

Есть две школы — обе приемлемы. Просто знай, что мы выбрали более «низкоуровневую».

## Жизненный цикл объекта-сущности

Сущность бывает в одном из четырёх состояний:

1. **Transient** — только что создан через `new`, БД о нём не знает.
2. **Managed** (= persistent) — Hibernate отслеживает изменения. После `save()` или `findById()`.
3. **Detached** — был managed, но сессия закрылась.
4. **Removed** — помечен на удаление.

Главный фокус: пока объект **managed**, любой `setter` автоматически приведёт к `UPDATE` при коммите транзакции. Не нужно явно вызывать `save()`.

## Контрольные вопросы

1. Что делает `@Entity`?
2. Зачем нужен `@NoArgsConstructor`?
3. Что делает `@Data` от Lombok?
4. Чем `@Column(name="...")` отличается от поля без аннотации?
5. Зачем `@Id` и `@GeneratedValue`?
6. Зачем `columnDefinition = "text"` для `originalText`?

## Мини-упражнение

Представь, что мы хотим добавить в книгу поле `coverUrl` (ссылка на обложку, может быть пустая, до 500 символов).

Напиши, как должно выглядеть это поле:

<details>
<summary>Подсказка / решение</summary>

```java
@Column(name = "cover_url", columnDefinition = "varchar(500)")
private String coverUrl;
```
- `nullable = false` НЕ ставим (поле может быть пустым).
- `columnDefinition` ограничивает длину.

Чтобы оно действительно появилось в БД, нужно ещё добавить колонку через миграцию (Drizzle).
</details>

## Что дальше

Сущности есть — теперь надо научиться доставать их из БД. Это делается одной строчкой через Spring Data: **[Глава 08 — Репозитории →](08-репозитории.md)**
