# Milestone Progress Report

## ✅ Current Milestone

- M6 — Mobile App & Provider Experience (In Progress)
- Completed subtasks:
  - Provider job queue API endpoint (`GET /jobs/available`)
  - Provider assignments API endpoint (`GET /jobs/provider/assignments`)
  - Provider dashboard mobile screen with tab switcher (Available Jobs / My Assignments)
  - Job cards with customer info and quote submission UI
  - Assignment cards with status badges and schedule display
  - Empty states and loading indicators for mobile screens
  - Job detail screen with full job information display
  - Quote submission form with amount and notes fields
  - Quote submission integration with API endpoint (`POST /jobs/:id/quotes`)
  - Provider profile management screen with services display
  - Location update functionality for providers (lat/lng input)
  - Online status display (view-only toggle)
  - Real-time job updates via polling (30-second auto-refresh, pull-to-refresh, app foreground refresh)
- Remaining subtasks:
  - Push notification setup (Expo Push Notifications)
  - In-app messaging UI between customers and providers

## 📋 Previous Milestones

- M5 — Payments & Reviews (Completed)

  - Review/rating system with star ratings (1-5) and comments
  - Review validation (job verified, duplicate prevention, role enforcement)
  - Review statistics endpoint (average stars, distribution by rating)
  - Full Stripe PaymentIntent flow with manual capture (authorize → capture)
  - Refund handling with amount validation and Stripe integration
  - Payment DTOs with validation (CreatePaymentIntentDto, CapturePaymentDto, CreateRefundDto)
  - Payment API endpoints (create intent, capture, refund)
  - Stripe webhooks for async event handling (payment_intent.succeeded, payment_intent.payment_failed, charge.refunded)
  - Stripe Connect account creation and onboarding for providers
  - Stripe Connect payout transfers (85% of payment to providers)
  - Connect account management endpoints (create account, onboarding link, status check, payout creation)
  - Prisma schema updates (Payment, Refund, Review models with relations)
  - Graceful degradation when Stripe is not configured
  - Admin web UI for payment management (capture, refund controls)
  - Admin web UI for review moderation (user lookup, star ratings)
  - Reusable ReviewForm and ReviewList components

- M4 — Fulfillment & Automation (Completed)
  - Assignment scheduling with optimistic locking (customer/provider can propose windows)
  - BullMQ-based reminder worker with configurable lead times and overdue detection
  - Payment capture placeholders with Stripe integration stubs
  - Payout status tracking (PENDING, AWAITING_APPROVAL, APPROVED, PAID, BLOCKED)
  - Notifications service integration for schedule proposals and reminders
  - Scheduling API endpoints (`POST /jobs/:id/schedule`, `POST /assignments/:id/schedule/confirm`)
  - Assignment rejection flow with provider-initiated rejection capability
  - Comprehensive M4 documentation (Fulfillment, Tickets, Sprint Plan, Grooming, Coordination, Reminder Worker Runbook)

## ⚡ Next After M6

- M7 — Analytics & Optimization
- Potential features:
  - Provider analytics dashboard
  - Customer usage metrics
  - Platform performance monitoring
  - A/B testing infrastructure

## 📌 Notes

- Stripe: real onboarding requires valid `STRIPE_SECRET_KEY`/webhook secret; currently returns a mock URL when unset/placeholders
- BullMQ reminder worker requires Redis connection (`REDIS_URL` env var)
- Reminder worker env vars: `REMINDER_WORKER_ENABLED`, `REMINDER_LEAD_MINUTES`, `REMINDER_LOOKAHEAD_MINUTES`, `REMINDER_OVERDUE_MINUTES`, `REMINDER_POLL_INTERVAL_MS`, `REMINDER_WORKER_CONCURRENCY`
- Assignment model includes reminder status tracking: NONE, QUEUED, SENT, OVERDUE
- Payment capture stubs detect placeholder Stripe keys and route to manual approval queue
- Ensure only one API dev instance runs (avoid EADDRINUSE on :3001)
- CSP hardening: web currently runs with `ENABLE_STRICT_CSP=true` at `CSP_STRICT_LEVEL=balanced` (dev+prod). TODO: audit all inline scripts/styles and flip to `strict` in compose when safe.

## 📌 Notes (continued)

- Mobile app (`apps/mobile-uber-polished`) is a git submodule with separate commit history
- Provider dashboard requires authentication with PROVIDER role
- Job availability filtered by providers who haven't quoted yet
- Assignment status badges: PENDING (yellow), SCHEDULED (blue), IN_PROGRESS (green), COMPLETED (gray)

Last updated: 2025-10-04 22:30:00Z
