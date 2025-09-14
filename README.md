# ServiceLink — Real‑Time Local Services Marketplace (M0 Bootstrap)


[![CI](https://github.com/Dev1ai/ServiceLink/actions/workflows/ci.yml/badge.svg)](https://github.com/Dev1ai/ServiceLink/actions/workflows/ci.yml)

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
3) **Start DB/Cache (and optionally API + metrics stack)**:
```bash
docker compose -f infra/docker-compose.yml up -d postgres redis
# Or, to run everything in containers (API + Web + Nginx + Prometheus + Grafana):
docker compose -f infra/docker-compose.yml up -d postgres redis api web nginx prometheus grafana
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

If you started the API via Docker Compose, you don't need `pnpm dev` for the API. The container runs `pnpm --filter api dev` and exposes port 3001.
When Nginx is running, use:
- Web: http://localhost:8080
- API via proxy: http://localhost:8080/api (Swagger at http://localhost:8080/docs) — WebSockets at ws://localhost:8080/ws

### Optional HTTPS for Nginx (local)
Generate local certs (mkcert or openssl) into `infra/certs`:
```bash
# Using mkcert (recommended)
./infra/mkcert.sh

# Or with openssl (self-signed)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/certs/privkey.pem -out infra/certs/fullchain.pem \
  -subj "/CN=localhost"
```
Swap Nginx config to SSL and expose 443:
```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "8443:443"
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro
```
Then access: https://localhost:8443

Content Security Policy (CSP)
- The web app is refactored to avoid inline styles/scripts, so it works with a strict, nonce‑free CSP.
- App middleware (`apps/web/middleware.ts`) sets a strict CSP at runtime when `ENABLE_STRICT_CSP=true`.
  - Strictness via `CSP_STRICT_LEVEL=balanced|strict` (default `balanced`).
  - React style attributes are not used anywhere; inline styles are disallowed by policy with no escape hatch.
- Static export does not run middleware. Configure CSP at your CDN/host; suggested header:
  - `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-ancestors 'self'; base-uri 'self'; object-src 'none'`
- Next export: `apps/web` supports `NEXT_OUTPUT=export next build` (`pnpm -C apps/web build:export`). Note: dynamic route segments (e.g., `/jobs/[id]/...`) are not supported by static export unless you provide `generateStaticParams`; use the normal server build for those.

#### Production setup (server build)
- Set `ENABLE_STRICT_CSP=true` in the web app environment to emit CSP headers.
- Ensure `NEXT_PUBLIC_API_BASE_URL` is set to the browser‑reachable API base (e.g., `https://yourdomain.com/api` behind a reverse proxy).
- WebSockets: CSP already allows `ws:`/`wss:`. Ensure your reverse proxy forwards WebSockets at a path your UI uses (default `ws://host:port/ws`).

#### Static hosting
- Use `pnpm -C apps/web build:export` and serve `apps/web/out/`.
- Set the strict CSP header at your CDN/edge as shown above.
- Dynamic routes are skipped in export builds. Use query‑param pages (e.g., `/jobs/quote?id=...`) or provide `generateStaticParams` for a finite set.
### Production build via Docker
Build and run the API using the production Dockerfile and compose override:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build api
```
This uses `apps/api/Dockerfile` to build the API and runs it with `node apps/api/dist/main.js`.

To build and run both API and Web (and Nginx) in production mode:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build api web nginx
```
Web expects `NEXT_PUBLIC_API_BASE_URL` to be reachable by the browser; defaults to `/api` behind Nginx.

### Realtime (M2)
- WebSocket namespace: `ws://localhost:3001/ws`
- Auth: pass JWT as `Authorization: Bearer <token>` header, or `auth: { token }` in Socket.IO client
- Events:
  - `presence:update` (server → clients): `{ online: string[] }`
  - `room:join` / `room:leave` (client → server): join/leave custom rooms (e.g., `job:<id>`)
  - `typing` (both directions): `{ room, isTyping, userId? }`
  - `rate_limit` (server → client): `{ kind: 'typing'|'chat', ttl, limit }` when an action is throttled
- Horizontal scale: if `REDIS_URL` is set, the Socket.IO Redis adapter is enabled automatically

### Rate Limiting & Errors
- Global rate limiter with Nest Throttler v5 (default 120 req/min per IP), Redis-backed if `REDIS_URL` is set.
- Auth limits:
  - `POST /auth/signup`: 5/min
  - `POST /auth/login`: 10/min
- Standard error shape (JSON):
```
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["password must be longer than or equal to 8 characters"],
  "path": "/auth/signup",
  "timestamp": "2025-09-13T00:00:00.000Z"
}
```

Rate limiting configuration (env overrides)
- Global default: `RATE_DEFAULT_TTL`, `RATE_DEFAULT_LIMIT`
- Quotes (accept/revoke): `QUOTES_RATE_TTL`, `QUOTES_RATE_LIMIT`, plus per-role overrides `QUOTES_RATE_TTL_CUSTOMER`, `QUOTES_RATE_LIMIT_CUSTOMER`, `QUOTES_RATE_TTL_PROVIDER`, `QUOTES_RATE_LIMIT_PROVIDER`
- Jobs creation: `JOBS_RATE_TTL`, `JOBS_RATE_LIMIT`, plus per-role overrides `JOBS_RATE_TTL_CUSTOMER`, `JOBS_RATE_LIMIT_CUSTOMER`, `JOBS_RATE_TTL_PROVIDER`, `JOBS_RATE_LIMIT_PROVIDER`
- Search/near: `SEARCH_RATE_TTL`, `SEARCH_RATE_LIMIT`, plus per-role overrides `SEARCH_RATE_TTL_CUSTOMER`, `SEARCH_RATE_LIMIT_CUSTOMER`, `SEARCH_RATE_TTL_PROVIDER`, `SEARCH_RATE_LIMIT_PROVIDER`

Notes
- Admins bypass throttling. Authenticated users are keyed by `user.sub` (not IP).
- With `REDIS_URL`, storage is distributed across instances.
- WebSocket throttling: gateway emits `rate_limit` with `{ kind, ttl, limit }`; clients should back off sends for `ttl` seconds.
 - HTTP 429 responses include a `Retry-After` header (seconds) to indicate when the client can retry.

### Redis-backed demo
- If `REDIS_URL` is set:
  - Health endpoint increments a counter: `GET /health` → `{ ok, ts, usingRedis: true, hits }`
  - Socket.IO uses Redis adapter for multi-instance presence/events
  - Throttler uses Redis storage for distributed rate limits

### cURL examples
- Health with Redis (call twice; hits increases):
```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/health | jq .
```

- Throttle login (expect 429 after burst):
```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "[%{http_code}] " \
    -X POST http://localhost:3001/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"provider@example.com","password":"password123"}';
done; echo
```

- Error payload example (validation):
```bash
curl -s -X POST http://localhost:3001/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"bad","password":"short","name":"A"}' | jq .
```

- Presence endpoints:
```bash
# Presence list
curl -s http://localhost:3001/presence | jq .
# Presence config (TTL)
curl -s http://localhost:3001/presence/config | jq .
# Force reconcile (requires ADMIN token)
ADMIN_TOKEN=... \
curl -s -X POST http://localhost:3001/presence/reconcile -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

## Environment

Copy `.env.example` to `.env` and fill secrets. The API reads `.env` at repo root.

Required keys for auth and provider onboarding:

- `JWT_SECRET` — used to sign API JWTs.
- `STRIPE_SECRET_KEY` or `STRIPE_SECRET` — Stripe secret for Connect onboarding.
- `STRIPE_WEBHOOK_SECRET` — verify Stripe webhooks (optional in dev).
- `STRIPE_RETURN_URL` / `STRIPE_REFRESH_URL` — onboarding redirect URLs.
- `REDIS_URL` — enables Redis-backed Socket.IO adapter and presence storage.
- `SENTRY_DSN` — optional Sentry instrumenting (init in main.ts).
- `POSTHOG_API_KEY` — optional PostHog server events.

Notes:
- If Stripe secrets are missing or obviously placeholders, the API returns a mock onboarding URL (`https://connect.stripe.com/setup/mock`) so you can continue local dev.
- Swagger UI is available at `http://localhost:3001/docs` with the `auth` and `providers` tags.

## CI

GitHub Actions workflow in `.github/workflows/ci.yml` lints, typechecks, builds.  
Add cloud secrets as repository secrets before enabling deploy steps.

### Local testing

- API unit tests and HTTP-style tests:
  - `pnpm --filter api exec jest -c jest.config.ts --passWithNoTests`
  - Run specific tests: `pnpm --filter api exec jest -c jest.config.ts --runTestsByPath src/providers/providers.controller.spec.ts -i`
- Web lint: `pnpm --filter web lint`
- API lint: `pnpm --filter api lint`

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
### Metrics
- Prometheus metrics at `GET /metrics` (text/plain; prom exposition format)
- Includes Node.js default metrics; add a Prometheus scrape job pointing to `localhost:3001/metrics`

#### Run Prometheus + Grafana locally
```bash
docker compose -f infra/docker-compose.yml up -d prometheus grafana
# Prometheus UI: http://localhost:9090 (scrapes host.docker.internal:3001 by default)
# Grafana UI:    http://localhost:3030 (admin/admin)
```
Add a Prometheus data source in Grafana pointing to `http://prometheus:9090` and import a dashboard for Node.js metrics.

#### Custom metrics exposed
- `auth_signup_total{role}`
- `auth_login_total{role}`
- `ws_connect_total{role,redis}`
- `ws_typing_total{room}`
- `ws_chat_send_total{room}`

Notes for Linux Docker
- Compose maps `host.docker.internal` to the host via `extra_hosts`. If your Docker version does not support `host-gateway`, either:
  - Change `infra/prometheus.yml` target to your host IP (e.g., `172.17.0.1:3001`), or
  - Run the API inside Docker and change the target to the API service name.

Grafana Variables
- The provided dashboard includes variables:
  - `$role` derived from label_values(auth_login_total, role)
  - `$room` derived from label_values(ws_chat_send_total, room)
