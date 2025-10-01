# Milestone Progress Report

## ✅ Current Milestone
- M3 — Jobs & Matching
- Completed subtasks:
  - Customer job creation API + web form with validation
  - Provider discovery flows (search + near) with radius filtering and Next UI helpers
  - Quote lifecycle: provider submit/list, customer accept/revoke, assignment sync, notifications
  - Realtime job chat persisted to Prisma with history fetch in web demo
  - Static export-safe job links (fallback routes for quotes/quote form)

## ⚡ Next Milestone
- M4 — Fulfillment & Automation
- Planning references:
  - Scope + requirements in `docs/M4-Fulfillment.md`
  - Ticket backlog in `docs/M4-Tickets.md`
  - Sprint allocations in `docs/M4-Sprint-Plan.md`
  - Grooming checklist in `docs/M4-Grooming.md`
  - Coordination checklist in `docs/M4-Coordination.md`
- Immediate next steps:
  - Lock scope (scheduling, workflow automation, payment capture follow-ups) with stakeholders
  - Identify coverage gaps/tests to finish before handing off M3
  - Document new env requirements + ops runbooks for automation pieces
  - Decide on background job framework (BullMQ vs cron) and capture in ADR

## 📌 Notes
- Stripe: real onboarding requires valid `STRIPE_SECRET_KEY`/webhook secret; currently returns a mock URL when unset/placeholders
- Ensure only one API dev instance runs (avoid EADDRINUSE on :3001)
- Next.js config cleaned up (removed experimental appDir warning)
- Consider normalizing DTOs across auth/users/providers to one shared shape and extracting to `packages/schemas`

- CSP hardening: web currently runs with `ENABLE_STRICT_CSP=true` at `CSP_STRICT_LEVEL=balanced` (dev+prod). TODO: audit all inline scripts/styles and flip to `strict` in compose when safe.

\nLast updated: 2025-09-18 11:42:00Z
