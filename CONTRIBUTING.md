# Contributing Guide

Thanks for your interest in contributing! This mono‑repo contains:

- `apps/api`: NestJS API (REST + WebSockets)
- `apps/web`: Next.js (App Router) app (strict CSP, no inline styles)
- `apps/marketing`: Static export marketing site
- `infra`: Docker Compose, Terraform stubs

## Getting Started

```bash
make compose-dev   # DB + API + Web
make seed          # prisma generate/push/seed
make e2e           # strict-CSP Playwright tests (API at :3001)
```

API dev only:

```bash
pnpm --filter api build && NODE_ENV=development node apps/api/dist/main.js
```

Web dev only:

```bash
ENABLE_STRICT_CSP=true pnpm --filter web build && pnpm --filter web start
```

## Guidelines

- Web (apps/web): Do not use inline `<style>`/`<script>` or React `style={...}` props. Use `app/globals.css` utilities.
- CSP: Middleware enforces strict, nonce‑free CSP. Client JS must be external modules.
- Tests: Prefer small unit tests for API; web E2E is in `apps/web/tests`.
- Commits/PRs: Keep PRs focused; update README/Docs when behavior changes.

## Static Marketing

- App is in `apps/marketing`. It must remain export‑safe.
- No dynamic data fetching or server APIs.
- Navigation lives in `app/layout.tsx`. See `apps/marketing/README.md` for details.

## Release

- Merge to `main` when CI/E2E is green.
- Run the “Create Tag (manual)” Action (patch/minor/major) to push a tag.
- A GitHub Release is auto‑published on tag push.
