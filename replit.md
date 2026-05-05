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
- **Authentication**: Clerk (whitelabel, JWT Bearer tokens validated by Spring Security OAuth2 Resource Server)

## Application: Lingua — Bilingual Reader

A bilingual reading app based on the Ilya Frank method. Users upload English books and read them with a parallel Russian translation. Clicking any word shows its Russian translation from a built-in AI dictionary. Each user has their own isolated book library.

### Features
- Clerk authentication — email + Google OAuth; each user sees only their own books
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
  - Auth: @clerk/react v6 with `useAuth()` hook; JWT injected via `setAuthTokenGetter`
  - Generated API hooks from `@workspace/api-client-react`
- **API Server** (`artifacts/api-server`) — Spring Boot 3.2.5 backend, served at `/api`
  - Security: `spring-boot-starter-oauth2-resource-server` validates Clerk JWTs via JWKS
  - JWKS URI auto-derived from `CLERK_PUBLISHABLE_KEY` env var at startup
  - All `/api/**` routes require a valid `Authorization: Bearer <token>` header
  - `/api/actuator/**` is public

### Database Schema
- `books` — uploaded books; `user_id VARCHAR(255)` scopes each book to a Clerk user (`sub` claim)
- `paragraphs` — individual text paragraphs, with original and translated text
- `dictionary_lookups` — cached AI word lookups

### API Routes (all require auth except /api/actuator/*)
- `GET/POST /api/books` — list and create books (user-scoped)
- `POST /api/books/upload` — upload a .txt or .epub file (user-scoped)
- `GET/DELETE /api/books/:id` — book CRUD (ownership verified)
- `GET /api/books/:id/paragraphs` — paginated paragraph listing
- `GET /api/books/:id/translation-status` — translation progress
- `POST /api/books/:id/translate` — start AI translation (SSE stream)
- `GET /api/paragraphs/:id/translation` — single paragraph translation
- `GET /api/dictionary/lookup?word=` — AI dictionary lookup
- `GET /api/dictionary/recent` — recently looked up words
- `GET /api/books/:id/stats` — book statistics

### Auth Implementation Notes
- **Backend**: `SecurityConfig.java` decodes `CLERK_PUBLISHABLE_KEY` to derive JWKS URI (`https://<host>/.well-known/jwks.json`), then configures Spring Security OAuth2 Resource Server for stateless JWT auth. `userId = jwt.getSubject()` (Clerk's `sub` claim).
- **Frontend**: `ApiTokenInjector` component (inside ClerkProvider) calls `setAuthTokenGetter(() => getToken())` so every API request automatically includes `Authorization: Bearer <token>`.
- **Clerk components**: `<SignIn routing="path" path="/sign-in">` and `<SignUp routing="path" path="/sign-up">` with crimson `hsl(353, 50%, 29%)` brand color.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `mvn -f artifacts/api-server/pom.xml spring-boot:run` — run API server locally
- `pnpm --filter @workspace/bilingual-reader run dev` — run frontend locally
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
