# Milestone Progress Report

## ✅ Current Milestone
- M2 — Realtime & Presence
- Completed subtasks:
  - Socket.IO gateway at `/ws` with JWT auth and Redis adapter (if `REDIS_URL`)
  - Presence tracking (Redis-backed) with TTL + reconcile; REST `GET /presence`
  - Typing indicators + minimal room chat with persistence for `job:<key>` rooms; `GET /jobs/:key/messages`
  - Client demo page `/realtime` (login, connect, presence, chat, history)
  - Metrics: Prometheus `/metrics` + custom counters (auth/ws) + Grafana provisioning
  - Nginx reverse proxy (`/api`, `/ws`, `/docs`), docker-compose for dev/prod
  - Security: app-level nonce-based CSP (balanced), lint rules; CORS & security headers

## ⚡ Next Milestone
- M3 — Jobs & Matching
- Immediate next steps:
  - Job creation endpoint + schema (title, description, customerId) and basic validation
  - Provider discovery: list providers by service/category and distance (uses provider.radius)
  - Quote flow: POST `/jobs/:id/quotes` (provider-only), list quotes, accept assignment
  - Expand chat to associate with jobId consistently and load history in UI
  - Add basic notifications (email placeholder/logs) on quote/assignment

## 📌 Notes
- Stripe: real onboarding requires valid `STRIPE_SECRET_KEY`/webhook secret; currently returns a mock URL when unset/placeholders
- Ensure only one API dev instance runs (avoid EADDRINUSE on :3001)
- Next.js config cleaned up (removed experimental appDir warning)
- Consider normalizing DTOs across auth/users/providers to one shared shape and extracting to `packages/schemas`

- CSP hardening: web currently runs with `ENABLE_STRICT_CSP=true` at `CSP_STRICT_LEVEL=balanced` (dev+prod). TODO: audit all inline scripts/styles and flip to `strict` in compose when safe.

\nLast updated: 2025-09-13 01:05:34Z
