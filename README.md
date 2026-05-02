# Lingua — Bilingual Reader

A bilingual reading app based on the **Ilya Frank method**: English text on top (~82% of the screen), Russian translation below (~18%), synchronized scrolling. Tap any word to look it up in the AI-powered dictionary.

## Features

- Upload books as plain text (.txt) or EPUB (.epub)
- AI-powered English → Russian paragraph translation (streamed, batch processing)
- Synchronized dual-panel scrolling (EN / RU)
- Word dictionary: translation, transcription, part of speech, examples, English synonyms
- Table of contents, full-text search
- Reading progress persistence (per book)
- PWA — installable, works offline after first load
- Dark / sepia / light themes, adjustable font size and family

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React 19 + Vite 7 + TypeScript |
| Backend | **Java 17 + Spring Boot 3.2** |
| Database | PostgreSQL (accessed via Spring Data JPA + JDBC) |
| Schema migrations | Drizzle ORM (schema defined in `lib/db`) |
| API contract | OpenAPI 3 → Orval codegen (React Query hooks + Zod schemas) |
| AI | OpenAI gpt-4.1-mini (translation) / gpt-4.1-nano (dictionary) |
| Build (backend) | Maven |
| Build (frontend) | Vite + esbuild |

---

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Spring Boot API — served at /api
│   │   ├── pom.xml
│   │   └── src/main/java/com/lingua/api/
│   │       ├── LinguaApiApplication.java
│   │       ├── config/      # CORS, DataSource, Async
│   │       ├── controller/  # BookController, DictionaryController, UploadController, HealthController
│   │       ├── model/       # JPA entities (Book, Paragraph)
│   │       ├── repository/  # Spring Data repositories
│   │       └── service/     # BookService, TranslationService, DictionaryService, EpubParser, OpenAiService
│   └── bilingual-reader/    # React + Vite frontend — served at /
├── lib/
│   ├── api-spec/            # OpenAPI spec (openapi.yaml)
│   ├── api-client-react/    # Generated React Query hooks (do not edit by hand)
│   ├── api-zod/             # Generated Zod schemas (do not edit by hand)
│   └── db/                  # Drizzle schema + migrations
├── scripts/                 # Utility scripts
├── pnpm-workspace.yaml
└── package.json
```

---

## Prerequisites

- **Java 17+** (GraalVM 22.3 or any JDK 17+)
- **Maven 3.6+**
- **Node.js 20+** and **pnpm 9+** (for the frontend and schema migrations)
- **PostgreSQL** database (connection string in `DATABASE_URL`)
- **OpenAI API key** (set as `OPENAI_API_KEY`)

---

## Running Locally

### 1. Install Node dependencies (frontend + schema tools)

```bash
pnpm install
```

### 2. Set environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lingua
OPENAI_API_KEY=sk-...
SESSION_SECRET=some-random-string
```

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Start the API server (Spring Boot)

```bash
mvn -f artifacts/api-server/pom.xml spring-boot:run
```

The API starts on the port defined by the `PORT` environment variable (default: `8080`).  
All routes are prefixed with `/api` (context path is set to `/api`).

### 5. Start the frontend

```bash
pnpm --filter @workspace/bilingual-reader run dev
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/books` | List all books |
| `POST` | `/api/books` | Create a book from raw text `{title, author, language, content}` |
| `POST` | `/api/books/upload` | Upload a `.txt` or `.epub` file (multipart) |
| `GET` | `/api/books/:id` | Get book metadata |
| `DELETE` | `/api/books/:id` | Delete a book |
| `GET` | `/api/books/:id/paragraphs` | Paginated paragraphs (`?page=1&pageSize=20`) |
| `GET` | `/api/books/:id/translation-status` | Translation progress |
| `POST` | `/api/books/:id/translate` | Start AI translation (SSE stream) |
| `GET` | `/api/books/:id/chapters` | Table of contents (detected headings) |
| `GET` | `/api/books/:id/search` | Full-text search (`?q=word&limit=40`) |
| `GET` | `/api/books/:id/stats` | Word count, paragraph count, progress % |
| `GET` | `/api/paragraphs/:id/translation` | Single paragraph details |
| `GET` | `/api/dictionary/lookup` | Word lookup (`?word=&context=`) |
| `GET` | `/api/dictionary/recent` | Recently looked-up words (last 20) |

---

## Building for Production

```bash
# Build the Spring Boot fat JAR
mvn -f artifacts/api-server/pom.xml package -DskipTests

# Run the JAR
java -jar artifacts/api-server/target/lingua-api-server-0.0.1-SNAPSHOT.jar
```

---

## Useful Commands

```bash
# Regenerate API client after editing lib/api-spec/openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to the database
pnpm --filter @workspace/db run push

# Type-check the frontend
pnpm run typecheck
```

---

## Running Tests (Backend — Spring Boot)

Automated tests go in `artifacts/api-server/src/test/java/com/lingua/api/`.

### Unit tests

```bash
mvn -f artifacts/api-server/pom.xml test
```

### Integration / end-to-end tests

Start both the API server and the frontend before running e2e tests:

```bash
# Terminal 1 — API
mvn -f artifacts/api-server/pom.xml spring-boot:run

# Terminal 2 — Frontend
pnpm --filter @workspace/bilingual-reader run dev
```

Set `BASE_URL` and `API_URL` in your test environment to point to the running services.

---

## Running Tests (Frontend)

```bash
pnpm --filter @workspace/bilingual-reader run test
```

---

## Key Source Files

| File | Purpose |
|---|---|
| `artifacts/bilingual-reader/src/pages/reader.tsx` | Main reader: scroll sync, dictionary, alignment |
| `artifacts/bilingual-reader/src/components/book-paragraph.tsx` | EN/RU paragraph rendering, word/sentence tap |
| `artifacts/bilingual-reader/src/lib/sentences.ts` | Sentence splitting (abbreviation-aware) |
| `artifacts/api-server/src/main/java/com/lingua/api/service/DictionaryService.java` | Dictionary lookup + AI prompt |
| `artifacts/api-server/src/main/java/com/lingua/api/service/TranslationService.java` | AI translation pipeline + SSE |
| `artifacts/api-server/src/main/java/com/lingua/api/service/BookService.java` | Book CRUD, chapters, search, stats |
| `lib/db/src/schema/` | Drizzle database schemas (used for migrations) |
| `lib/api-spec/openapi.yaml` | API contract (source of truth for frontend codegen) |

---

## For Testers

Everything a QA engineer needs to write automated tests against the API and the UI.

### Authentication & CORS

- **No authentication** — all endpoints are open. No tokens, cookies, or sessions are required.
- **CORS** — all origins, methods and headers are allowed (`*`). Cross-origin requests from a test runner will work.

### Limits & validation

| What | Limit / rule |
|---|---|
| Uploaded file size | **50 MB** (`spring.servlet.multipart.max-file-size`) |
| Allowed upload extensions | `.txt`, `.epub` |
| `POST /api/books` required fields | `title` (non-empty), `content` (non-empty) |
| `GET /books/:id/paragraphs?pageSize=` | max **100**, default **20** |
| `GET /books/:id/search?limit=` | max **80**, default **40** |
| `POST /books/:id/translate` body `batchSize` | default **8**, recommended ≤ **16** |
| Search query `q` | min length **1** |

### Standard error format

All errors return JSON in this shape:

```json
{ "error": "Human-readable message" }
```

| Status | When it occurs |
|---|---|
| `400` | Validation failed (missing field, file too big, unsupported extension, bad query param) |
| `404` | Book or paragraph not found |
| `409` | Translation already running for this book |
| `500` | OpenAI failure, DB error, or unhandled exception |
| `503` | OpenAI timeout / rate-limited |

### Example requests & responses

#### `GET /api/healthz`

```json
200 OK
{ "status": "ok" }
```

#### `POST /api/books`

```http
POST /api/books
Content-Type: application/json

{ "title": "Test", "author": "Anon", "language": "en", "content": "Hello world.\n\nSecond paragraph." }
```

```json
201 Created
{ "id": 42, "title": "Test", "author": "Anon", "language": "en",
  "totalParagraphs": 2, "translationStatus": "pending", "createdAt": "2026-05-02T10:00:00Z" }
```

#### `POST /api/books/upload`

```http
POST /api/books/upload
Content-Type: multipart/form-data

file=<binary .txt or .epub>
title=Optional override
```

Returns the same shape as `POST /api/books`.

#### `GET /api/books/:id/paragraphs?page=1&pageSize=20`

```json
200 OK
{
  "paragraphs": [
    { "id": 331, "bookId": 2, "position": 0,
      "originalText": "Hello.", "translatedText": "Привет.", "isTranslated": true }
  ],
  "total": 392, "page": 1, "pageSize": 20, "totalPages": 20
}
```

#### `GET /api/books/:id/translation-status`

```json
{ "bookId": 2, "status": "in_progress",
  "totalParagraphs": 392, "translatedParagraphs": 120, "progressPercent": 31 }
```

`status` ∈ `pending | in_progress | completed | failed`.

#### `POST /api/books/:id/translate` (Server-Sent Events)

Long-lived SSE stream. Each event is `data: <json>\n\n`. Event payloads:

```json
{ "type": "started", "total": 392 }
{ "type": "progress", "translated": 8,   "total": 392, "percent": 2 }
{ "type": "progress", "translated": 16,  "total": 392, "percent": 4 }
…
{ "type": "done",    "translated": 392, "total": 392 }
```

On failure:

```json
{ "type": "error", "message": "OpenAI request failed: 429" }
```

The stream closes after `done` or `error`. Multiple parallel calls for the same book return `409 Conflict`.

#### `GET /api/dictionary/lookup?word=hello&context=Hello%20world.`

```json
{
  "word": "hello",
  "translation": "привет",
  "transcription": "[həˈloʊ]",
  "partOfSpeech": "interjection",
  "examples": [{ "en": "Hello there!", "ru": "Привет!" }],
  "synonyms": ["hi", "hey", "greetings"]
}
```

`context` is optional but recommended (improves AI accuracy).

#### `GET /api/dictionary/recent`

Returns the **last 20** unique words looked up across all books, most recent first.

### Test fixtures

Sample files are NOT yet committed. Recommended setup for `src/test/resources/`:

- `sample-small.txt` — 5–10 short paragraphs, plain ASCII
- `sample-utf8.txt` — paragraphs containing `é`, `ñ`, `—`, `"smart quotes"`
- `sample-large.txt` — > 50 MB to test the upload limit (should reject)
- `sample.epub` — minimal valid EPUB with 2 chapters

For unit tests of `EpubParser`, place small EPUB fixtures in `src/test/resources/epub/`.

### Database setup for tests

The app uses a real PostgreSQL database. Two options:

**Option A — Testcontainers (recommended).** Add to `pom.xml`:

```xml
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <version>1.19.7</version>
  <scope>test</scope>
</dependency>
```

Then annotate the test class with `@Testcontainers` and start a `PostgreSQLContainer` per test class.

**Option B — Dedicated test DB.** Create `lingua_test`, point a separate `DATABASE_URL` at it, and reset between tests:

```sql
TRUNCATE books, paragraphs, dictionary_cache RESTART IDENTITY CASCADE;
```

The schema lives in `lib/db/src/schema/`. Apply it once with:

```bash
DATABASE_URL=postgres://...lingua_test pnpm --filter @workspace/db run push
```

### Mocking OpenAI

`/translate` and `/dictionary/lookup` call OpenAI. For deterministic tests:

- Inject a stub `OpenAiService` via `@MockBean` in `@SpringBootTest`.
- Or set `OPENAI_API_KEY` to a value and use **WireMock** to intercept `https://api.openai.com/v1/chat/completions`.
- The `DictionaryService` cache only stores entries where `synonyms.length > 0` — useful when asserting cache hits/misses.

### Heading detection (chapters)

`BookService.detectChapters()` flags a paragraph as a chapter heading when its `originalText` matches one of:

- `^(Chapter|CHAPTER|Глава|ГЛАВА)\s+[\dIVXLCDM]+`
- `^(Part|PART|Часть|ЧАСТЬ)\s+[\dIVXLCDM]+`
- `^(Prologue|Epilogue|Preface|Introduction|Foreword|Пролог|Эпилог|Предисловие|Введение)$` (case-insensitive, trimmed)
- All-caps lines of 3–60 characters with no terminal punctuation

When writing tests, craft fixture text that exercises both matches and near-misses.

### Frontend regression checklist

For UI / e2e tests (Playwright/Cypress) the critical flows are:

1. Upload a `.txt` file → book appears on home → opens reader → first paragraph visible.
2. Scroll EN panel → RU panel scrolls in sync (and vice versa).
3. Reload mid-book → reading position restored.
4. Tap a word → dictionary popup with translation, transcription, examples.
5. Tap a sentence → sentence-level translation appears.
6. Open table of contents → click chapter → reader scrolls to it.
7. Open search → enter query → tap a result → reader scrolls to that paragraph.
8. Switch theme (light / sepia / dark) → persists across reloads.
9. Trigger translation on a partially-translated book → progress bar advances → completes.
10. Install as PWA → reopen offline → previously loaded book is readable.

### Viewing logs

```bash
# Live API server logs
tail -f artifacts/api-server/target/spring.log     # if logging.file.name is set
# Otherwise stdout from `mvn spring-boot:run`

# Frontend logs — browser DevTools console
```

Spring Boot logs HTTP requests at INFO level. Set `logging.level.com.lingua=DEBUG` in `application.properties` for verbose output during test debugging.
