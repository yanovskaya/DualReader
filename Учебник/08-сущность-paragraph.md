# Шаг 08. Сущность `Paragraph`

🎯 **Цель:** есть Java-класс `Paragraph` и репозиторий для него.

📁 **Файлы шага:**
- `src/main/java/com/lingua/api/model/Paragraph.java` (новый)
- `src/main/java/com/lingua/api/repository/ParagraphRepository.java` (новый)

## 1. Сущность

**`src/main/java/com/lingua/api/model/Paragraph.java`**

```java
package com.lingua.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

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

🧠 **Что нового:**

- Поле `bookId` — простой `Integer`. Можно было бы сделать `@ManyToOne private Book book;`, но это тянет за собой автоматические JOIN-ы и сложности. Простое поле — быстрее и понятнее. Связь между книгой и параграфом проверяем сами в сервисах.
- `columnDefinition = "text"` для `originalText` — иначе JPA по умолчанию создал бы `VARCHAR(255)`, а у нас могут быть длинные абзацы.

> ⚠️ **Странность Lombok с `boolean isTranslated`:** для поля `private boolean isTranslated` Lombok сгенерирует геттер `isTranslated()` и сеттер `setTranslated(...)` — **без** префикса `is`. То есть в коде ниже мы будем писать `p.setTranslated(true)`, а не `p.setIsTranslated(true)`. Это поведение JavaBeans-конвенции: для `boolean`-полей с префиксом `is` префикс «съедается» при генерации геттера/сеттера. Если переименовать поле в `translated` (без `is`), Lombok сгенерит ровно то же самое.

## 2. Репозиторий

**`src/main/java/com/lingua/api/repository/ParagraphRepository.java`**

```java
package com.lingua.api.repository;

import com.lingua.api.model.Paragraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ParagraphRepository extends JpaRepository<Paragraph, Integer> {

    long countByBookId(Integer bookId);

    List<Paragraph> findByBookIdOrderByPosition(Integer bookId);
}
```

🧠 **Derived queries:**

Spring парсит имя метода → генерирует SQL:

| Имя метода | Сгенерированный SQL |
|---|---|
| `countByBookId(bookId)` | `SELECT COUNT(*) FROM paragraphs WHERE book_id = ?` |
| `findByBookIdOrderByPosition(bookId)` | `SELECT * FROM paragraphs WHERE book_id = ? ORDER BY position` |

Грамматика: `find` / `count` / `delete` + `By` + `<Поле>` + `<Условие>` + `OrderBy<Поле><Asc|Desc>`.

## ✅ Проверка

Перезапусти сервер. В логах должно быть:
```
Found 2 JPA repository interfaces.
```

(было 1, стало 2).

Эндпоинтов пока нет — на следующем шаге создадим книги вместе с параграфами.

## 🤔 Проверь себя

  1. Почему мы сделали `bookId` простым `Integer`, а не `@ManyToOne private Book book;`?
  2. Зачем `columnDefinition = "text"` для `originalText`?
  3. Как Spring Data понимает, что метод `countByBookId(Integer)` должен превратиться в `SELECT COUNT(*) ... WHERE book_id = ?`?

  <details>
  <summary>Мини-упражнение: добавь свой derived query</summary>

  Добавь в репозиторий метод, который вернёт количество **переведённых** параграфов в книге:

  ```java
  long countByBookIdAndIsTranslatedTrue(Integer bookId);
  ```

  Spring сам сгенерирует SQL: `SELECT COUNT(*) FROM paragraphs WHERE book_id = ? AND is_translated = true`.
  </details>

  ## ➡️ Дальше

Расширяем `POST /books`, чтобы он принимал большой текст и разбивал его на параграфы. [Шаг 09 — Разбиваем книгу на параграфы →](09-разбиение-на-параграфы.md)
