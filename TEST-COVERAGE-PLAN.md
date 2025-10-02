# Test Coverage Plan

This document outlines high‑value tests to add next. Each item can be delivered as a focused PR.

## API

- Providers
  - [ ] `/providers/services` — returns top service names with counts (groupBy)
  - [ ] `/providers/categories` — returns hierarchical tree (verify child attachment)
  - [ ] `/providers/location` — updates provider lat/lng (authZ: provider-only)
  - [ ] `/providers/assignments` — returns provider assignments (authZ)
  - [ ] `/providers/quotes` — returns quotes for current provider
- Jobs & Quotes
  - [ ] Negative: accept when assignment already exists → 400
  - [ ] Negative: accept non‑pending quote → 400
  - [ ] Revoke with no active acceptance → 400
  - [ ] Customer verify completion flow → updates assignment status
- Auth & Rate Limits
  - [ ] `/auth/signup` validation & per‑role rates
  - [ ] `/auth/login` validation & IP‑based rate limiting
- Realtime (unit‑focused)
  - [ ] wsAllowed rate limiting logic branches (typing/chat) with storage mock
  - [ ] presence reconcile removes stale users (Redis + in‑memory branches)

## Web

- Pages
  - [ ] Jobs list filters (only assigned) UI state persisted to URL/localStorage
  - [ ] Quote submit page shows cooldown UI on 429 (Retry‑After parsing)
  - [ ] Realtime page: join/leave emits and local chat throttling feedback
- Accessibility
  - [ ] TooltipInfo focus trap and escape key handling

## CI Enhancements

- [ ] Add a matrix job for Node 18/20 compatibility
- [ ] Cache Jest and Prisma client where beneficial

---

Prioritize endpoints with the most usage and risk (jobs/quotes, providers search/near). Keep HTTP tests “light” by mocking Prisma + guards and focusing on shape/validation.

