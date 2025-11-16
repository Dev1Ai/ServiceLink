# Milestone M4 — Fulfillment & Automation

## Purpose

Stand up the post-quote fulfillment workflow so accepted jobs move reliably from assignment through completion and payment. Focus on provider/customer scheduling, automated status nudges, and payment capture preparations while keeping export-safe web flows and Ops visibility intact.

## Primary Objectives

1. **Scheduling & Availability** – Capture preferred visit windows from both sides, surface conflicts, and ensure providers can propose/confirm times for accepted jobs.
2. **Workflow Automation** – Add background jobs/cron hooks to remind stakeholders (quote follow-up, visit reminders, completion nudges) with audit trails.
3. **Payment Readiness** – Track assignment lifecycle events (provider complete, customer verify, payout eligibility) and hook in Stripe capture placeholders.
4. **Operational Insights** – Expand metrics/logging so Ops can monitor job states, reminder send volumes, and failure alerts.

## Deliverables

- **API Enhancements**
  - `assignments` schema extensions: scheduled window, reminder flags, payout status, audit timestamps.
  - Endpoints for providers/customers to propose/confirm visit windows (`POST /jobs/:id/schedule`, `POST /assignments/:id/schedule/confirm`).
  - Background task runner (BullMQ or cron) driving reminder notifications; configuration via env (frequency, lead times).
  - Stripe capture stub endpoint triggered after customer verification; enqueue payout for manual review when Stripe keys missing (implemented via PaymentsService.handleCustomerVerification).
- **Web UI Updates**
  - Customer job detail surfaces schedule selection, reminder status, and completion checklist.
  - Provider assignments page gains scheduling controls, completion toggle, and status timeline.
  - Admin metrics dashboard section for fulfillment KPIs (jobs awaiting scheduling, overdue reminders, payout queue).
  - Admin payouts page (`/admin/payouts`) for reviewing manual approvals.
- **Notifications**
  - Extend `NotificationsService` to emit structured events (log + optional email stub) for scheduling and reminder flows.
  - Template stubs for email/SMS (plain text) with preview endpoints in dev.
- **Operations & Docs**
  - Runbook describing reminder worker deployment, env vars (`REMINDER_POLL_INTERVAL_MS`, `REMINDER_LEAD_MINUTES`, etc.), Stripe capture workflow, and fallback behavior when Stripe disabled. (See `docs/M4-Reminder-Worker-Runbook.md`.)
  - Document reminder worker env vars: `REMINDER_WORKER_ENABLED`, `REMINDER_LEAD_MINUTES`, `REMINDER_LOOKAHEAD_MINUTES`, `REMINDER_OVERDUE_MINUTES`, `REMINDER_POLL_INTERVAL_MS`, `REMINDER_WORKER_CONCURRENCY`.
  - Tests: API unit/e2e covering schedule proposals, reminder job, capture guardrails; web Playwright smoke for new UI paths.

## Dependencies & Assumptions

- Postgres migrations required (assignments table); ensure Prisma schema + generated client updates propagate to web/mobile packages if DTOs change.
- Redis already in place for presence—can be reused for BullMQ queues; confirm capacity/retention.
- Stripe keys may be absent in lower environments; automation must no-op gracefully and log warnings.
- Static export must continue to work; dynamic-only pages should have query-string fallbacks.

## Non-Goals

- Full payment settlement or refunds (defer to M5).
- Complex routing/dispatching beyond single-provider assignments.
- Native mobile parity (web-first, mobile follow-up).

## Risks & Mitigations

- **Reminder spam** if rate limits misconfigured → add guardrails & per-job reminder history.
- **Scheduling conflicts** when multiple edits occur → enforce optimistic locking/version field.
- **Stripe capture errors** → queue retries with exponential backoff and alert Ops via logs/metrics.
- **Background worker drift** if not deployed → document required processes in runbook + health check endpoint.

## Metrics & Acceptance Criteria

- Ops dashboard shows counts for: `awaiting_schedule`, `scheduled`, `reminder_overdue`, `payout_pending`.
- Reminder job metrics exported to Prometheus (`reminder_sent_total`, `reminder_failed_total`).
- End-to-end happy path: customer accepts quote → provider schedules → reminders logged → provider marks complete → customer verifies → Stripe capture stub invoked.
- Playwright test simulates customer scheduling UI without regressions to existing flows.

## Decisions

1. Calendar integrations (Google/ICS) are required alongside email summaries for scheduling.
2. Providers may reject assignments post-acceptance; rejected jobs must requeue for other providers.
3. Reminder “overdue” SLA will use a single global value configurable via env.
4. Ops will approve payouts (when Stripe keys are absent) through an Admin UI workflow.

## Next Steps

- Align with stakeholders to review decisions and fold them into product specs.
- Draft Prisma migration for assignment fields; confirm enums with product.
- Spike background job framework (BullMQ vs node-cron) and produce tech decision record.
- Define calendar integration approach (OAuth scopes, ICS generation) and capture in implementation notes.
- Design provider rejection flow (API + UI) including requeue logic.
- Set global reminder SLA env default and document override process.
- Plan Admin UI workflow for manual payout approvals and link to Ops runbook.
- Schedule UI/UX review to ensure scheduling controls and new flows meet usability standards.
