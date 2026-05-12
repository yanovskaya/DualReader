# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Spring Boot 3.2.5 (Java 17)
- **Database**: PostgreSQL + Spring Data JPA (Hibernate)
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini for translation, gpt-5-nano for dictionary)
- **Authentication**: None (removed)

## Application: Lingua — Bilingual Reader

A bilingual reading app based on the Ilya Frank method. Users upload English books and read them with a parallel Russian translation. Clicking any word shows its Russian translation from a built-in AI dictionary.

### Features
- No login required — open immediately
- Upload books as plain text or EPUB (title, author, content)
- AI-powered English→Russian translation (batch, SSE progress stream)
- Parallel paragraph display (English | Russian)
- Word-click dictionary lookup with translations, part of speech, and examples
- Translation progress tracking
- Book library with status badges and progress bars
- PWA with offline reading via IndexedDB + Service Worker caching

### Artifacts
- **Bilingual Reader** (`artifacts/bilingual-reader`) — React + Vite + Tailwind v4 frontend, served at `/`
  - Router: wouter v3
  - State: @tanstack/react-query
  - No auth; API requests need no token
  - Generated API hooks from `@workspace/api-client-react`
- **API Server** (`artifacts/api-server`) — Spring Boot 3.2.5 backend, served at `/api`
  - No Spring Security; all endpoints are public
  - All books stored under fixed `user_id = "default"`

### Database Schema
- `books` — uploaded books; `user_id VARCHAR(255)` column kept (always `"default"`)
- `paragraphs` — individual text paragraphs, with original and translated text
- `dictionary_lookups` — cached AI word lookups

### API Routes (all public)
- `GET/POST /api/books` — list and create books
- `POST /api/books/upload` — upload a .txt or .epub file
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
- `mvn -f artifacts/api-server/pom.xml spring-boot:run` — run API server locally
- `pnpm --filter @workspace/bilingual-reader run dev` — run frontend locally
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
