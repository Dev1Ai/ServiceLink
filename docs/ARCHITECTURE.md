# Architecture Overview

ASCII overview
```
+--------------------+            HTTP(S) + WS(S)            +------------------+
|    Browser (Web)   | <------------------------------------> |     API (Nest)   |
|  Next.js App Router|                                         |  REST + WebSocket|
|  - Pages (app/**)  |   Static export (optional)              |  Modules:        |
|  - CSP Middleware  |  ------------------------------>  CDN   |  - auth          |
|  - Utility CSS     |                                         |  - jobs/quotes   |
|  - Socket.IO client|                                         |  - providers     |
+--------------------+                                         |  - realtime (WS) |
            ^                                                   |  - metrics/health|
            |                                                   +---------+--------+
            |                                                             |
            |                                                             |
            |                                                     +-------+-------+
            |                                                     |   Postgres    |
            |                                                     |   (Prisma)    |
            |                                                     +-------+-------+
            |                                                             |
            |                                               (optional)     |
            |                                                     +-------+-------+
            |                                                     |    Redis      |
            |                                                     |  (presence,   |
            |                                                     |   throttling) |
            |                                                     +---------------+
```

## Mermaid Diagram (rendered on GitHub)

```mermaid
flowchart LR
  subgraph B[Browser]
    W[Next.js App Router\n(Utility CSS, No inline)]
  end
  CDN[CDN / Static Host]
  API[NestJS API\nREST + WebSocket]
  DB[(Postgres\nPrisma)]
  R[(Redis\nPresence/Rate Limits)]

  W -- HTTP(S) --> API
  W <-. WS(S) .-> API
  W -- Static Export --> CDN
  API <-- SQL --> DB
  API <-- pub/sub --> R

  classDef note fill:#f6faff,stroke:#cfe3ff,color:#0b3b8c
  CSP[CSP Middleware\n(Strict, nonce-free)]:::note
  W -. enforced by .- CSP
```

## Key Components
- Web (Next.js, apps/web)
  - App Router pages under `app/**` (Jobs, Providers, Realtime, Metrics, etc.).
  - Strict, nonce‑free CSP via `apps/web/middleware.ts` when `ENABLE_STRICT_CSP=true`.
  - No inline styles/scripts; utility CSS in `app/globals.css`.
  - Static export available; dynamic `[id]` routes are skipped; use query‑param pages if needed.

- API (NestJS, apps/api)
  - Auth (`/auth/*`), Jobs + Quotes (`/jobs/*`), Providers (`/providers/*`), Realtime (WS), Metrics, Health.
  - Role‑aware rate limiting via guards (env configurable).
  - Prisma ORM for Postgres; optional Redis for presence and distributed throttling.

## Data Flows
- Auth: Browser → API `/auth/login` → Browser stores JWT (localStorage) → subsequent REST/WS calls with JWT.
- Jobs/Quotes: Customer creates job; provider posts quote; customer accepts/revokes; customer verifies completion.
- Providers: Search and Near endpoints filter by service/category/online and optional geo distance; front‑end renders list and map.
- Realtime: Socket.IO client connects to API WS namespace `/ws`; presence, typing, and chat events.
- Metrics: Front‑end polls `/metrics` and renders simple charts.

## Security & CSP
- Middleware sets CSP headers; disallows inline styles/scripts and React style props.
- Dev CSP allows `http:` in `connect-src` for local API; production restricts to `https:` and `ws(s):`.

## CI & E2E
- CI provisions Postgres/Redis, seeds DB, builds API & Web, then runs Playwright E2E under strict CSP.
- E2E covers: CSP headers/no violations, auth flow, realtime chat, quotes accept/revoke/verify, providers near/search, categories.
