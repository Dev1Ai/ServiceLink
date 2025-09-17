# Repository Guidelines

## Project Structure & Module Organization
- `apps/api` – NestJS REST/WebSocket service; Prisma schema lives at `prisma/`; Jest specs in `apps/api/test`.
- `apps/web` – Next.js admin UI; modules under `app/`; Playwright specs in `apps/web/tests`; middleware enforces strict CSP.
- `apps/mobile` – Expo React Native client; keep screens under `app/` and reuse `packages/schemas`.
- `apps/marketing` – static Next.js marketing site; must stay export-safe.
- Shared libraries sit in `packages/*`; infrastructure in `infra/`; see `docs/` for architecture notes.

## Build, Test & Development Commands
- `pnpm dev` (or `make dev`) runs Turbo dev tasks for API and web; `pnpm --filter mobile dev` launches Expo.
- `pnpm lint` runs workspace ESLint; run `pnpm format` to apply Prettier (2-space indent, single quotes).
- Database lifecycle: `pnpm db:generate`, `pnpm db:push`, `pnpm db:seed`; use `make compose-db` to start Postgres/Redis locally.
- API: `pnpm --filter api build` compiles Nest, `pnpm --filter api test` and `pnpm --filter api test:e2e` execute unit and e2e suites.
- Web: `pnpm --filter web build` (or `build:export` for static) and `pnpm --filter web test:e2e`/`make e2e` run Playwright under CSP.

## Coding Style & Naming Conventions
- TypeScript across the repo; rely on Prettier defaults (2 spaces, trailing commas) and existing ESLint configs.
- Keep React components in `PascalCase`, hooks/utilities `camelCase`, and files/folders `kebab-case` to mirror current layout.
- Avoid inline styles or scripts; enforce CSP-friendly styling via `app/globals.css` utilities.
- Publish shared DTO changes through `packages/schemas` and regenerate Prisma clients so web/mobile stay in sync with the API.

## Testing Guidelines
- API tests use Jest (`*.spec.ts`, `*.e2e-spec.ts`); follow `TEST-COVERAGE-PLAN.md` to prioritize additions and prefer Prisma mocks for unit cases.
- Web E2E lives in `apps/web/tests/*.spec.ts`; run with `pnpm --filter web test:e2e` after ensuring the API is reachable on `http://localhost:3001`.
- Marketing/mobile rely on manual QA; add Playwright or Expo smoke tests for critical flows.
- Cover new endpoints/components before review and update mocks when contracts change.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`type(scope): summary`) as in history (`feat(marketing): …`, `chore(ci): …`); squash noisy fixups before pushing.
- Keep PRs tightly scoped, document schema changes in `README.md` or `docs/`, and add screenshots or curl snippets for updates.
- Link GitHub issues or milestones when relevant and call out new env vars or migrations in the PR description.
- Confirm CI (lint, Jest, Playwright) before handoff; re-run `make e2e` whenever CSP or realtime logic is touched.
