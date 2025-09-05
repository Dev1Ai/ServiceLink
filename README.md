# ServiceLink — Real‑Time Local Services Marketplace (M0 Bootstrap)

**Playbook Version:** Canvas “Custom Instructions – Build a Real‑Time Local Services Marketplace App (ChatGPT‑5 Playbook)” — current as of 2025‑08‑30  
**Release Tag (proposal):** `v0.1.0-m0-bootstrap`

This repo is a **Turborepo** monorepo with:
- **apps/api**: NestJS API (REST + WebSockets) with health route and Swagger.
- **apps/web**: Next.js (App Router) admin/marketing skeleton.
- **apps/mobile**: Expo React Native app (Customer/Provider modes) with availability toggle & map stub.
- **infra**: Docker Compose (Postgres + Redis), Render/Vercel deploy descriptors.
- **prisma**: Postgres schema and seed script.
- **packages/schemas**: Shared zod DTOs usable by web/mobile/api.

## Quickstart

1) **Prereqs**: Node 20+, pnpm 9+, Docker Desktop (or compatible).  
2) **Install deps**:
```bash
pnpm i
```
3) **Start DB/Cache**:
```bash
docker compose up -d
```
4) **Generate Prisma & migrate**:
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```
5) **Dev all apps** (turbo runs in parallel):
```bash
pnpm dev
```
- API: http://localhost:3001 (Swagger at `/docs`)
- Web: http://localhost:3000
- Mobile: `pnpm --filter mobile start` (Expo)

## Environment

Copy `.env.example` to `.env` and fill secrets. The API reads `.env` at repo root.

## CI

GitHub Actions workflow in `.github/workflows/ci.yml` lints, typechecks, builds.  
Add cloud secrets as repository secrets before enabling deploy steps.

## Deploy (overview)

- **API (Render)**: see `infra/render.yaml`.  
- **Web (Vercel)**: connect repo, set env vars from `.env.example`.  
- **Mobile (Expo EAS)**: configure in `apps/mobile/app.config.ts`, then `eas build --platform ios|android`.

## Next Steps

- M1: Auth + Provider onboarding (Clerk + Stripe Connect).  
- Wire real WebSockets (presence) & Redis in API.  
- Add PostHog, Sentry & OpenTelemetry exporters.
