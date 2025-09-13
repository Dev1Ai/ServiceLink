# Milestone Progress Report

## ✅ Current Milestone
- M1 — Auth & Provider Onboarding
- Completed subtasks:
  - JWT-based auth (signup, login) with bcrypt password hashing
  - Role support (CUSTOMER, PROVIDER, ADMIN) via Prisma enum
  - Hydrated “me” endpoints: `/auth/me`, `/users/me`, `/providers/me`
  - Provider onboarding stub with Stripe Connect; mock URL fallback without real keys
  - Swagger docs with JWT bearer auth; tagged `auth` and `providers`
  - Prisma schema + seed: three users (admin, provider, customer)

## ⚡ Next Milestone
- M2 — Realtime & Presence (+ Redis)
- Immediate next steps:
  - Wire NestJS WebSockets gateway for job chat/presence
  - Integrate Redis pub/sub for presence state
  - Expose `/ws` events and basic typing/online indicators
  - Add PostHog & Sentry SDKs (env gated)
  - Update README with ws usage and env keys

## 📌 Notes
- Stripe: real onboarding requires valid `STRIPE_SECRET_KEY`/webhook secret; currently returns a mock URL when unset/placeholders
- Ensure only one API dev instance runs (avoid EADDRINUSE on :3001)
- Next.js config cleaned up (removed experimental appDir warning)
- Consider normalizing DTOs across auth/users/providers to one shared shape and extracting to `packages/schemas`

