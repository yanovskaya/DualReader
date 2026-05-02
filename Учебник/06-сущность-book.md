# Шаг 06. Первая сущность `Book`

🎯 **Цель:** есть Java-класс `Book`, отображающий таблицу `books`, и репозиторий, через который можно сохранять/доставать книги.

📁 **Файлы шага:**
- `src/main/java/com/lingua/api/model/Book.java`
- `src/main/java/com/lingua/api/repository/BookRepository.java`

## Что такое ORM

**ORM** = Object-Relational Mapping. Связывает таблицы БД с Java-классами:
- Таблица `books` ↔ класс `Book`.
- Колонка `title` ↔ поле `title`.
- Строка в таблице ↔ объект.

Стандарт ORM в Java — **JPA**, реализация — **Hibernate**, а **Spring Data JPA** добавляет «магические репозитории».

## 1. Класс `Book`

Создай папку и файл:
```bash
mkdir -p src/main/java/com/lingua/api/model
```

**`src/main/java/com/lingua/api/model/Book.java`**

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

🧠 **Разбор аннотаций:**

| Аннотация | Что делает |
|---|---|
| `@Entity` | «это JPA-сущность» (= таблица) |
| `@Table(name="books")` | имя таблицы |
| `@Data` (Lombok) | сгенерируй геттеры, сеттеры, equals, hashCode, toString |
| `@NoArgsConstructor` (Lombok) | создай пустой конструктор (требует JPA) |
| `@Id` | первичный ключ |
| `@GeneratedValue(IDENTITY)` | БД сама сгенерирует значение (auto-increment) |
| `@Column(nullable=false)` | NOT NULL |
| `@Column(name="created_at")` | имя колонки в БД (snake_case) отличается от имени поля (camelCase) |
| `@Column(updatable=false)` | Hibernate никогда не делает UPDATE этой колонки |

🧠 **Особый случай — PG enum:**

```java
@Column(name = "translation_status", columnDefinition = "translation_status")
private String translationStatus = "pending";
```
JPA не умеет нормально работать с PG-енумами. Мы храним поле как `String`, а через `columnDefinition` указываем тип в БД. PostgreSQL сам валидирует.

## 2. Репозиторий `BookRepository`

```bash
mkdir -p src/main/java/com/lingua/api/repository
```

**`src/main/java/com/lingua/api/repository/BookRepository.java`**

```java
package com.lingua.api.repository;

import com.lingua.api.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookRepository extends JpaRepository<Book, Integer> {

    List<Book> findAllByOrderByCreatedAtAsc();
}
```

🧠 **Разбор:**

- Это **интерфейс**, не класс! Spring Data сам сгенерирует реализацию во время старта.
- `extends JpaRepository<Book, Integer>` где `Book` — сущность, `Integer` — тип ID.
- **Бесплатно** получаем: `save(book)`, `findById(id)`, `findAll()`, `deleteById(id)`, `count()` и др.
- `findAllByOrderByCreatedAtAsc()` — это **derived query**. Spring парсит ИМЯ метода и сам генерирует SQL: `SELECT * FROM books ORDER BY created_at ASC`.

## ✅ Проверка

Перезапусти сервер:
```bash
mvn spring-boot:run
```

В логах должно появиться:
```
Bootstrapping Spring Data JPA repositories in DEFAULT mode.
Finished Spring Data repository scanning ... Found 1 JPA repository interface.
```

Если есть — репозиторий найден. Эндпоинта пока нет, поэтому через `curl` мы это не увидим. На следующем шаге сделаем эндпоинты.

> Если хочется немедленной проверки — можно временно добавить в `LinguaApiApplication.java` `CommandLineRunner`-бин, который при старте сделает `bookRepo.save(...)` и распечатает `findAll()`. Но это необязательно — мы это всё равно проверим эндпоинтами.

## 🤔 Проверь себя

  1. Что делает `@Entity` и почему без него ничего не работает?
  2. Зачем `@GeneratedValue(strategy = GenerationType.IDENTITY)`? Что было бы без него?
  3. Почему в Spring Data JPA нам достаточно объявить **интерфейс** репозитория, без реализации?

  <details>
  <summary>Мини-упражнение: добавь поле без миграции</summary>

  Что произойдёт, если ты добавишь в `Book` новое поле `@Column private String description;`, но **не** добавишь колонку в таблицу?

  **Ответ:** при `SELECT` Hibernate спросит у БД колонку `description`, получит ошибку «column does not exist» и упадёт. Поэтому при `spring.jpa.hibernate.ddl-auto=none` схема в БД и сущности должны совпадать вручную.
  </details>

  ## ➡️ Дальше

Делаем первые HTTP-эндпоинты для книг. [Шаг 07 — GET /books и POST /books →](07-books-crud.md)
