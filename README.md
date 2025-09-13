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

Required keys for auth and provider onboarding:

- `JWT_SECRET` — used to sign API JWTs.
- `STRIPE_SECRET_KEY` or `STRIPE_SECRET` — Stripe secret for Connect onboarding.
- `STRIPE_WEBHOOK_SECRET` — verify Stripe webhooks (optional in dev).
- `STRIPE_RETURN_URL` / `STRIPE_REFRESH_URL` — onboarding redirect URLs.

Notes:
- If Stripe secrets are missing or obviously placeholders, the API returns a mock onboarding URL (`https://connect.stripe.com/setup/mock`) so you can continue local dev.
- Swagger UI is available at `http://localhost:3001/docs` with the `auth` and `providers` tags.

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

## API cURL Cheatsheet

Auth (email/password):

```bash
# Signup (defaults role to CUSTOMER when omitted)
curl -s -X POST http://localhost:3001/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "alice@example.com",
    "password": "password123",
    "name": "Alice Example",
    "role": "CUSTOMER"
  }'

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' | jq -r .access_token)

echo "TOKEN: ${TOKEN:0:20}..."

# Current user
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/auth/me | jq .
```

Providers (requires role PROVIDER):

```bash
# Login seeded provider (from seed script)
PROV_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"provider@example.com","password":"password123"}' | jq -r .access_token)

# Onboarding link (mock URL unless Stripe secrets are set)
curl -s -X POST http://localhost:3001/providers/onboarding \
  -H "Authorization: Bearer $PROV_TOKEN" | jq .

# Provider profile
curl -s -H "Authorization: Bearer $PROV_TOKEN" \
  http://localhost:3001/providers/me | jq .
```
