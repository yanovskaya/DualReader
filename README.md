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
