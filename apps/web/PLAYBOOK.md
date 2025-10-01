# Custom Instructions – Build a Real‑Time Local Services Marketplace App (ChatGPT‑5 Playbook)

These instructions tell ChatGPT‑5 exactly how to plan, code, test, and deploy a production‑ready app that matches the following product statement:

An app where businesses can list service offerings (plumbers, lawn care, roofers, dog groomers, transportation providers, dog walkers, sitters, electricians, handymen, movers, furniture transport, etc.). Users can see a “Currently Available” section (like ride‑share) to request immediate service or quotes, track provider arrival in real‑time, chat/voice, and pay in‑app. The app uses location services and integrates LLMs/ML, speech‑to‑text, and AI to maximize best/highest use.

---

## 0) Operating Mode & Ground Rules (for ChatGPT‑5)
- Be opinionated: use the default stack below unless the user explicitly changes it.
- Ship in slices: produce working end‑to‑end verticals (auth → UI → API → DB → tests) per milestone.
- Always return runnable assets: include commands, env vars, seed data, migrations, CI config, and deployment steps.
- Security by default: least‑privilege, PII minimization, encrypted secrets, Stripe for PCI scope reduction.
- Observability: instrument logs, metrics, traces, and error reporting from day one.
- Test first when feasible; otherwise include unit + integration tests in the same PR.
- No dead ends: every deliverable must include next steps and rollback guidance.

---

## 1) Product Scope & Roles

### Roles
- Customer: browses categories, posts jobs, requests immediate help, tracks provider ETA, pays, rates.
- Provider: onboards (KYC + docs), sets service categories, schedule, service radius, goes Online/Offline, accepts jobs/quotes, navigates, completes work, gets paid.
- Admin: verifies providers, manages disputes/refunds, category taxonomy, pricing rules, promotions, and support.

### Core Features
1. Discovery: category browsing, search, filters, map view.
2. Currently Available (real‑time roster): show online providers within radius; request immediate service or instant quote.
3. Jobs & Quotes: customers post details (text/voice/photo/video), providers submit quotes or accept on‑demand requests.
4. Tracking: live location/ETA (like ride‑share), status updates (en‑route, on‑site, in‑progress, completed).
5. Messaging & Voice: in‑app chat + optional masked calling; speech‑to‑text for job creation.
6. Payments: upfront hold, progress payments, tips, refunds, Stripe Connect payouts to providers.
7. Ratings/Reviews & issue resolution.
8. LLM/ML Assist: intake structuring, category matching, quote drafting, safety redaction, job‑summary, and provider ranking.
9. Notifications: push, SMS/email fallbacks, webhook retries.

---

## 2) Opinionated Tech Stack (Default)
- Monorepo: Turborepo (pnpm) or Nx.
- Mobile App: React Native + Expo (EAS build, OTA updates).
- Web Admin + Marketing Site: Next.js (App Router) + React Server Components.
- Backend: Node.js + TypeScript, NestJS (REST + WebSockets). Alternative acceptable: FastAPI (Python) with similar structure.
- Database: PostgreSQL + Prisma ORM, pgvector for embeddings.
- Cache/Queues: Redis + BullMQ.
- Storage: S3‑compatible (AWS S3 / Cloudflare R2) for media uploads.
- Maps/Geo: Google Maps Platform (Places, Maps SDK, Distance Matrix for ETA) or Mapbox + Valhalla.
- Auth & Identity: Clerk (email/phone/social, MFA) or Auth.js + custom JWT; Stripe Connect Express for provider KYC/payouts.
- Payments: Stripe (PaymentIntents, Connect, webhooks, disputes).
- Notifications: Expo Push + FCM/APNs; email via Resend/SES; SMS via Twilio (masked numbers for privacy).
- LLM/STT: OpenAI GPT‑4o/GPT‑5 for LLM tasks; Whisper (API or server) / Deepgram for speech‑to‑text.
- Search/Analytics: PostHog (product analytics, feature flags, session replays), DB full‑text search.
- Observability: Sentry (errors) + OpenTelemetry traces + structured logs (pino) shipped to a log sink.
- Infra: Docker + docker‑compose for dev; Render or Fly.io for API; Vercel for Next.js; Neon/Aiven for Postgres; Upstash/Redis Cloud for Redis.
- CI/CD: GitHub Actions (lint, typecheck, tests, build, deploy). Secrets via Doppler or 1Password.

Naming: working title ServiceLink (change later).

---

## 3) System Architecture (High‑Level)
- Clients: RN/Expo app (Customer/Provider modes) + Next.js Admin.
- API Gateway (NestJS):
  - REST for CRUD & webhooks
  - WebSockets for real‑time presence, job events, and chat
  - Background workers for geofencing, ETA refresh, webhook retries, payouts
- Postgres for relational data + pgvector for embeddings; Redis for presence, rate limits, queues.
- Stripe for payments + payouts; Twilio for optional masked calls.
- Maps for geocoding, distance/ETA; Expo for push notifications.

---

## 4) Data Model (Initial)
- `users`: id, role (`customer` | `provider` | `admin`), email, phone, password_hash, status, created_at.
- `profiles`: user_id FK, first_name, last_name, avatar_url, rating, city, state.
- `providers`: user_id FK, company_name, ein_or_ssn_last4, service_radius_km, online, kyc_status, stripe_account_id.
- `provider_documents`: provider_id, document_type (`license` | `insurance` | `background`), file_url, verified_at.
- `categories`: id, name, slug, parent_id.
- `services`: id, category_id, name, base_price, unit (`hour` | `fixed`), metadata JSONB.
- `provider_services`: provider_id, service_id, price_override, minimum_callout_fee.
- `service_areas`: provider_id, polygon_geojson.
- `availability_windows`: provider_id, weekday, start_time, end_time, overrides_json.
- `location_pings`: provider_id, lat, lng, speed, heading, recorded_at. (Also cached in Redis for real time.)
- `jobs`: id, customer_id, category_id, status (`draft` → `completed`), address, lat, lng, description, media_urls[], created_at, scheduled_for, requires_quote.
- `job_line_items`: job_id, title, quantity, unit_price.
- `quotes`: id, job_id, provider_id, total_amount, expires_at, notes, status (`pending` | `accepted` | `rejected` | `withdrawn`).
- `assignments`: job_id, provider_id, accepted_at, eta_seconds, started_at, completed_at.
- `chat_messages`: id, job_id, sender_user_id, message_type (`text` | `image` | `system`), content, created_at.
- `payments`: job_id, customer_id, stripe_payment_intent_id, amount, currency, status.
- `payouts`: provider_id, stripe_transfer_id, amount, status.
- `refunds`: payment_id, amount, reason, status; pair with disputes table if Stripe webhook indicates escalation.
- `reviews`: job_id, rater_user_id, ratee_user_id, stars, comment, created_at.
- `notifications`: user_id, kind, payload_json, delivered_at.
- `embeddings`: owner_type (`user` | `provider` | `policy`), owner_id, vector (pgvector).

Indexes: GIST on geo columns (`service_areas`, `location_pings`, `jobs`). Btree composite indexes on `(status, created_at)`, `(provider_id, online)`, `(job_id)` for related tables. Use prisma soft deletes where needed (e.g., jobs cancelled).

---

## 5) API Design (Selected Endpoints)
**Auth & Onboarding**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/otp/verify`.
- `POST /providers/onboarding` → generate Stripe Connect Express link + return redirect URL.

**Discovery**
- `GET /categories` and `GET /services?category_id=`.
- `GET /providers/available?lat&lng&radius_km` (uses Redis geo index + Postgres fallback).

**Jobs & Quotes**
- `POST /jobs` accepts text/voice/photo payload; pipeline normalizes via LLM before persisting.
- `GET /jobs/:id`, `PATCH /jobs/:id` for status transitions (draft → open → assigned → completed/cancelled).
- `POST /jobs/:id/quotes` and `POST /quotes/:id/accept`.
- WebSocket namespace `jobs:*` for status, ETA, and chat messages.

**Tracking**
- `POST /providers/ping` for foreground/background location updates (validates provider online status).
- `GET /jobs/:id/eta` calculates ETA via Distance Matrix, with Redis cache to cap calls.

**Payments & Reviews**
- `POST /payments/intent`, `POST /payments/capture`, `POST /payments/refund`.
- `POST /webhooks/stripe` (idempotent, verifies signature).
- `POST /jobs/:id/review`, `GET /reviews?job_id=`, `GET /notifications`.

**Admin**
- CRUD for categories/services, provider document verification, dispute management, impersonation (read only), feature flag toggles.

---

## 6) Real-Time Presence & Matching
- Providers toggle Online/Offline; state stored in Redis with TTL (90s) and geo index (geohash buckets).
- Customer request builds candidate set: filter by radius, category, availability window, compliance state.
- Rank by weighted score: distance (40%), acceptance rate (20%), rating (20%), responsiveness (10%), price alignment (10%).
- On-demand flows fan out via ring-group notifications; first provider to accept locks assignment. Quote flows wait for best offer until timeout or best score.
- Refresh ETA via Distance Matrix; push updates over WebSocket with graceful fallback to polling.
- Cleanup cron prunes stale presence entries and re-evaluates assignments with liveness checks.

---

## 7) LLM, STT & "Best/Highest Use" Automations
- Intake NLU converts raw text/voice/photos into structured job payload (category, sub tasks, duration, materials, risk flags).
- Redaction strips PII before prompts (phone numbers, full addresses) while allowing approximate location context.
- Provider quote assistant drafts line items, scope, exclusions, and terms; shown for manual edits before submission.
- Matching pipeline enriches provider/job embeddings for ranking; store vectors in pgvector-backed table.
- Knowledge RAG serves policy answers and support macros from curated documents.
- Summaries auto-generate job completion notes and receipts with status timeline.
- Speech-to-text (Whisper or Deepgram) supports job creation, chat voice notes, and provider updates while driving.
- Prompt templates live in version-controlled folder with regression tests for critical outputs.

---

## 8) Security, Privacy & Compliance
- Enforce RBAC with route guards and ownership checks per job/provider.
- Encrypt PII columns (name, phone, address) and set strict retention for geo + chat data.
- Secrets managed via Doppler or 1Password; never commit `.env`.
- Stripe data handled through Elements/tokens; webhook handlers are idempotent and verify signatures.
- Append-only audit log captures admin actions and payouts edits.
- Signed URLs protect media uploads; virus-scan provider documents before storage.
- Rate limiting + CAPTCHA for auth sensitive routes; WAF via Vercel/Cloudflare.

---

## 9) Dev Experience, CI/CD & Observability
- **Repo layout**
  ```text
  /apps
    /mobile      # Expo RN app (customer + provider modes)
    /web         # Next.js admin/marketing
    /api         # NestJS REST/WS + workers
  /packages
    /ui          # shared RN/React components
    /config      # eslint, tsconfig, prettier
    /schemas     # zod DTOs, OpenAPI, prompt templates
  /infra         # docker-compose, terraform (optional), deploy manifests
  /.github/workflows/ci.yml
  ```
- **Scripts:** `pnpm dev`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm test`, `pnpm lint`, `pnpm build`.
- **Tests:** Jest/Vitest for units, Supertest for API, Playwright for web, Detox for mobile smoke, contract tests for shared SDKs.
- **Observability:** pino structured logs, Sentry (client + server), OpenTelemetry traces exported to preferred backend.

---

## 10) Deployment Targets (Default)
- API: Render or Fly.io with autoscaling, managed Postgres + Redis, connected S3/R2 bucket.
- Web: Vercel with preview environments and edge cache/backends as required.
- Mobile: Expo EAS for iOS/Android, release channels for staging/prod plus OTA updates.
- DNS & WAF: Cloudflare providing SSL termination, caching, and security rules.
- Include one-click buttons (Render blueprint, Vercel deploy) and CLI deployment instructions in deliverables.

---

## 11) Milestones & Acceptance Criteria
- **M0 – Bootstrap (Week 0):** Turborepo scaffold, Docker compose for Postgres/Redis, health check route. Deliver repo zip, README quickstart, `.env.example`, green CI.
- **M1 – Auth & Provider Onboarding (Week 1):** Auth.js/Clerk login, profiles, RBAC, Stripe Connect onboarding + webhooks. Deliver API routes, mobile flows, tests.
- **M2 – Categories, Services, Discovery (Week 2):** CRUD categories/services, customer discovery list/map, provider service configuration. Deliver seeds, admin UI, map screen, tests.
- **M3 – Real-Time Availability & Jobs (Week 3):** Redis presence, nearby providers endpoint, LLM-structured job creation, chat. Deliver WS channels, ETA handling, RN screens, E2E demo.
- **M4 – Quotes, Assignment, Tracking (Week 4):** Provider quotes, instant accept, live tracking timeline. Deliver acceptance logic, race condition handling, retry strategy.
- **M5 – Payments & Reviews (Week 5):** Stripe PaymentIntents, refunds, payouts, ratings/reviews. Deliver end-to-end payment flow, dispute handling, admin tools.
- **M6 – LLM, STT & RAG (Week 6):** Whisper intake, quote assistant, policy RAG, safety redaction. Deliver prompt templates, tests, latency budgets.
- **M7 – Hardening & Beta (Week 7):** Load/security review, monitoring dashboards, runbook, pilot launch. Deliver playbooks, on-call guide, rollback plan.

Timelines are placeholders—adjust per scope but keep each milestone shippable with passing tests.

---

## 12) What to Return per Milestone (Non-Negotiable)
1. **Code:** full file tree with per-file diffs, Prisma migrations, seed scripts.
2. **Infrastructure:** docker-compose, deploy manifests (Render/Vercel/Fly), worker config.
3. **Environment:** `.env.example` with purpose, default, and secret owner for each variable.
4. **Docs:** updated README quickstart, feature docs, OpenAPI/Swagger, Postman collection.
5. **Tests:** unit + integration + E2E guidance, sample data fixtures, coverage focus per TEST-COVERAGE-PLAN.md.
6. **Monitoring:** Sentry wiring, health endpoints, synthetic check instructions, rollback steps.

---

## 13) Sample Prompts & Checklists (Reusable)
### 13.1 Bootstrap Prompt
```
Create a Turborepo monorepo with apps/mobile (Expo RN), apps/web (Next.js), and apps/api (NestJS).
Configure Prisma with Postgres and Redis via docker-compose. Add pnpm workspaces, ESLint/Prettier, Husky pre-commit.
Generate base screens (Auth, Home, Map) and a healthcheck API route. Provide commands, .env.example, and a README.
```

### 13.2 Feature Slice Prompt (Real-Time Availability)
```
Implement provider Online/Offline presence.
API: POST /providers/status { online: boolean }; store in Redis with TTL 90s and geo index.
Endpoint GET /providers/available?lat&lng&radius_km.
Mobile: toggle switch plus background location ping every 30s when Online.
Include WebSocket channel presence:* for roster updates and tests for staleness cleanup.
```

### 13.3 Debugging Checklist
- Reproduce with seed data, capture pino JSON logs, include Sentry event link.
- Verify env vars and secrets; confirm webhook signatures (Stripe/Twilio).
- Inspect Redis TTL drift, WS backpressure, idempotency keys on mutations.
- Confirm DB migrations, monitor for N+1 queries, review slow query log.

### 13.4 Security Review Checklist
- RBAC unit tests on sensitive routes.
- PII mapping, retention policy, encrypted columns verified.
- Rate limits + CAPTCHA on auth/high-risk flows.
- Signed upload URLs with content-type validation and scanning pipeline.

---

## 14) Risks & Mitigations
- **Location accuracy / ETA drift:** use high-accuracy mode only when providers are online; snap-to-road; fall back to last known location.
- **Provider scarcity:** seed supply, allow scheduled jobs/quotes, expand radius with honest ETA messaging.
- **Fraud & chargebacks:** enable Stripe 3DS, device fingerprinting, hold funds until completion photos and sign-off.
- **LLM hallucinations:** constrain prompts with schemas (zod), include guardrails, require human confirmation for critical messages.
- **Push reliability:** combine WebSockets, push notifications, and SMS fallback with idempotent retries.

---

## 15) Open Questions (Assumptions until clarified)
- Target launch regions and tax rules (affects Stripe tax, service fees, receipt content).
- Whether provider background checks beyond Stripe KYC are required.
- If recurring services (weekly lawn care, etc.) are in scope for v1.
- Whether multi-provider jobs (crews) must be supported at launch.
- Cancellation and rescheduling policy, including fees and SLA commitments.

---

## 16) Immediate Next Step (Executable)
Return in the next message:
1. Repo bootstrap (monorepo scaffolding commands and file tree).
2. Initial `schema.prisma` with migrations.
3. NestJS API skeleton (auth, providers, jobs, payments modules).
4. Expo starter screens (Auth, Home, Map, Availability Toggle).
5. `docker-compose` for Postgres and Redis.
6. Render + Vercel deploy plan with environment variables.

All assets must be runnable locally with:
```bash
pnpm i && docker compose up -d && pnpm db:migrate && pnpm dev
```

---

This playbook is the contract: follow it to produce production-grade code and deployments for a real-world launch. Edit the stack sections if the user changes constraints (cloud, auth, payments, etc.).
