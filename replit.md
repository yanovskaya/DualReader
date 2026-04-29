# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini for translation, gpt-5-nano for dictionary)

## Application: Lingua — Bilingual Reader

A bilingual reading app based on the Ilya Frank method. Users upload English books and read them with a parallel Russian translation. Clicking any word shows its Russian translation from a built-in AI dictionary.

### Features
- Upload books as plain text (title, author, content)
- AI-powered English→Russian translation (batch, SSE progress stream)
- Parallel paragraph display (English | Russian)
- Word-click dictionary lookup with translations, part of speech, and examples
- Translation progress tracking
- Book library with status badges and progress bars

### Artifacts
- **Bilingual Reader** (`artifacts/bilingual-reader`) — React + Vite frontend, served at `/`
- **API Server** (`artifacts/api-server`) — Express 5 backend, served at `/api`

### Database Schema
- `books` — uploaded books with translation status
- `paragraphs` — individual text paragraphs, with original and translated text
- `dictionary_lookups` — cached AI word lookups

### API Routes
- `GET/POST /api/books` — list and upload books
- `GET/DELETE /api/books/:id` — book CRUD
- `GET /api/books/:id/paragraphs` — paginated paragraph listing
- `GET /api/books/:id/translation-status` — translation progress
- `POST /api/books/:id/translate` — start AI translation (SSE stream)
- `GET /api/paragraphs/:id/translation` — single paragraph translation
- `GET /api/dictionary/lookup?word=` — AI dictionary lookup
- `GET /api/dictionary/recent` — recently looked up words
- `GET /api/books/:id/stats` — book statistics

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
