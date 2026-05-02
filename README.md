# Lingua — Bilingual Reader

A bilingual reading app based on the **Ilya Frank method**: English text on top (~82% of the screen), Russian translation below (~18%), synchronized scrolling. Tap any word to look it up in the AI-powered dictionary.

## Features

- Upload books as plain text (title, author, body)
- AI-powered English → Russian paragraph translation (streamed)
- Synchronized dual-panel scrolling (EN / RU)
- Word dictionary: translation, transcription, part of speech, examples, English synonyms
- Table of contents, full-text search
- Manual sentence alignment anchors (EN ↔ RU)
- Reading progress persistence (per book)
- PWA — installable, works offline after first load
- Dark / sepia / light themes, adjustable font size and family

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | React 19 + Vite 7 + TypeScript |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| API contract | OpenAPI 3 → Orval codegen (React Query hooks + Zod schemas) |
| AI | OpenAI gpt-4.1 (translation) / gpt-4.1-nano (dictionary) |
| Build | esbuild |

---

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Express API — served at /api
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

- **Node.js** 20+
- **pnpm** 9+
- **PostgreSQL** database (connection string in `DATABASE_URL`)
- **OpenAI API key** (set as `OPENAI_API_KEY`)

---

## Running Locally

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set environment variables

Create a `.env` file in the repo root (or export the variables):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lingua
OPENAI_API_KEY=sk-...
SESSION_SECRET=some-random-string
```

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Start the API server

```bash
pnpm --filter @workspace/api-server run dev
```

The API starts on the port defined by the `PORT` environment variable (default: 8080).
All routes are prefixed with `/api`.

### 5. Start the frontend

In a separate terminal:

```bash
pnpm --filter @workspace/bilingual-reader run dev
```

The frontend starts on its own port (see terminal output). Open the printed URL in your browser.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/books` | List all books |
| `POST` | `/api/books` | Upload a new book |
| `GET` | `/api/books/:id` | Get book metadata |
| `DELETE` | `/api/books/:id` | Delete a book |
| `GET` | `/api/books/:id/paragraphs` | Paginated paragraphs (`?page=1&pageSize=40`) |
| `GET` | `/api/books/:id/translation-status` | Translation progress |
| `POST` | `/api/books/:id/translate` | Start AI translation (SSE stream) |
| `GET` | `/api/books/:id/chapters` | Table of contents |
| `GET` | `/api/books/:id/stats` | Word count, paragraph count |
| `GET` | `/api/dictionary/lookup` | Word lookup (`?word=&context=`) |
| `GET` | `/api/dictionary/recent` | Recently looked up words |

---

## Useful Commands

```bash
# Type-check the entire workspace
pnpm run typecheck

# Regenerate API client after editing lib/api-spec/openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to the database
pnpm --filter @workspace/db run push

# Build the API server bundle
pnpm --filter @workspace/api-server run build
```

---

## Running Tests

Automated tests can be placed in any package. To run all tests:

```bash
pnpm run test
```

To run tests for a specific package:

```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/bilingual-reader run test
```

The API server and frontend must both be running for end-to-end tests.
Set `BASE_URL` to the frontend URL and `API_URL` to the API URL in your test environment.

---

## Key Source Files

| File | Purpose |
|---|---|
| `artifacts/bilingual-reader/src/pages/reader.tsx` | Main reader: scroll sync, dictionary, alignment |
| `artifacts/bilingual-reader/src/components/book-paragraph.tsx` | EN/RU paragraph rendering, word/sentence tap |
| `artifacts/bilingual-reader/src/lib/sentences.ts` | Sentence splitting (abbreviation-aware) |
| `artifacts/api-server/src/routes/dictionary.ts` | Dictionary lookup + AI prompt |
| `artifacts/api-server/src/routes/books.ts` | Book upload, translation pipeline |
| `lib/db/src/schema/` | Drizzle database schemas |
| `lib/api-spec/openapi.yaml` | API contract (source of truth for codegen) |
