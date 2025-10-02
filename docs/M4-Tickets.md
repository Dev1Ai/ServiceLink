# Milestone M4 — Ticket Backlog

> Draft backlog derived from `docs/M4-Fulfillment.md`. Assign owners and sprint buckets during milestone kickoff.

## 1. Scheduling & Calendar Integrations

### T1: Expand Assignment Schema for Scheduling Fields *(Owner: Backend – Alex, Sprint: M4-S1)*
- **Summary:** Add Prisma fields for `scheduledStart`, `scheduledEnd`, `scheduleProposedBy`, `scheduleVersion`, `rejectedAt`, and reminder metadata.
- **Acceptance Criteria:**
  - Prisma migration adds new columns with sensible defaults/nullability.
  - Generated Prisma client updated and committed.
  - API DTOs/types updated in `packages/schemas` if exposed externally.
  - Backfilled existing records with null schedule fields via migration script.
- **Dependencies:** Finalize enum names in product spec; coordinate with mobile team on DTO exposure.

### T2: API Endpoints for Propose/Confirm/Reject Scheduling *(Owner: Backend – Priya, Sprint: M4-S1)*
- **Summary:** Implement REST endpoints for providers/customers to propose visit windows and confirm or request changes.
- **Acceptance Criteria:**
  - `POST /jobs/:id/schedule` (customer propose) + `POST /assignments/:id/schedule` (provider propose) with validation.
  - `POST /assignments/:id/schedule/confirm` to accept proposed window.
  - `POST /assignments/:id/reject` to allow provider post-acceptance rejection; triggers requeue.
  - Rate limiting aligned with role guards; error states covered.
  - Unit + e2e tests covering happy path, conflict version mismatch, unauthorized access.
- **Dependencies:** T1 completed; notification hooks defined (T4, T5).

### T3: Calendar Integration Service *(Owner: Platform – Wei, Sprint: M4-S2)*
- **Summary:** Build service to generate ICS files and optional Google Calendar links for scheduled assignments.
- **Acceptance Criteria:**
  - Creates ICS attachment per assignment; stored in S3 or generated on demand.
  - Generates Google Calendar deep link using OAuth scopes if configured.
  - Exposed via NotificationsService (see T5).
  - Feature flag/env toggles for enabling integrations.
  - Integration tests (mock calendar, ICS validation).
- **Dependencies:** OAuth configuration decision; security review for scopes.

## 2. Workflow Automation & Reminders

### T4: Background Worker Foundation *(Owner: DevOps – Sam, Sprint: M4-S1)*
- **Summary:** Choose BullMQ (or cron) and stand up worker process for reminders and payout queue.
- **Acceptance Criteria:**
  - Worker app (NestJS module or separate script) connecting to Redis queue.
  - Health endpoint + metrics (`reminder_sent_total`, `reminder_failed_total`).
  - Configuration via env (`REMINDER_CRON`, `REMINDER_LOOKAHEAD_MINUTES`).
  - Documentation added to Ops runbook.
- **Dependencies:** Redis availability confirmed; DevOps sign-off.

### T5: Reminder Job Implementation *(Owner: Backend – Alex, Sprint: M4-S2)*
- **Summary:** Implement recurring job that inspects assignments and queues notifications based on SLA.
- **Acceptance Criteria:**
  - Uses global SLA env to mark assignments as `reminder_overdue`.
  - Sends structured notification events through NotificationsService.
  - Deduplicates reminders per assignment; persists reminder history.
  - Tests cover overdue detection, dedupe, error handling.
- **Dependencies:** T1 schema fields available; T4 worker live; T5 relies on T6 notifications.

## 3. Notifications & Communications

### T6: NotificationsService Enhancements *(Owner: Backend – Priya, Sprint: M4-S2)*
- **Summary:** Extend service for scheduling/reminder events with structured payloads + email/SMS stubs.
- **Acceptance Criteria:**
  - New methods: `notifyScheduleProposed`, `notifyScheduleConfirmed`, `notifyAssignmentRejected`, `notifyReminderSent`.
  - Logs include metadata; optional email preview endpoints in dev.
  - ICS attachments + calendar links embedded when available (depends on T3).
  - Unit tests verifying payload shapes.
- **Dependencies:** T3 calendar service, message templates from design.

## 4. Provider Requeue & Assignment Lifecycle

### T7: Provider Rejection & Requeue Workflow *(Owner: Backend – Priya, Sprint: M4-S3)*
- **Summary:** When provider rejects post-acceptance, requeue job for other providers and notify stakeholders.
- **Acceptance Criteria:**
  - Assignment status transitions to `rejected`; job available for quoting or auto-offers.
  - Notifications dispatched to customer + ops.
  - Metrics updated (new Prometheus gauge for `assignments_requeued_total`).
  - Tests ensure race conditions handled.
- **Dependencies:** T2 endpoint, T6 notifications.

### T8: Admin UI for Manual Payout Approvals *(Owner: Web – Dana, Sprint: M4-S3)*
- **Summary:** Build admin web flow to review assignments awaiting payout when Stripe disabled.
- **Acceptance Criteria:**
  - Protected admin route listing `payout_pending` assignments.
  - Approve/deny actions auditing to DB with user + timestamp.
  - Hooks Stripe capture stub when keys present; logs fallback when not.
  - Playwright test covers approval path.
- **Dependencies:** T1 schema fields, API endpoints for admin approval (extend existing controllers).

## 5. Metrics & Observability

### T9: Fulfillment Metrics Dashboard *(Owner: Web – Miguel, Sprint: M4-S3)*
- **Summary:** Extend web metrics page with new KPIs and charts.
- **Acceptance Criteria:**
  - Metrics cards for `awaiting_schedule`, `scheduled`, `reminder_overdue`, `payout_pending`.
  - Graph of reminders sent over time pulling from Prometheus.
  - Respects CSP/export constraints.
- **Dependencies:** T4/T5 metrics emitted; Prometheus scraping updates.

### T10: Alerting & Logging Enhancements *(Owner: DevOps – Sam, Sprint: M4-S2)*
- **Summary:** Ensure Ops visibility for failures (worker crashes, payout approval backlog).
- **Acceptance Criteria:**
  - Structured logs with correlation IDs.
  - Alerts configured (PagerDuty/Webhook) when reminder failures spike or pending payouts exceed threshold.
  - Document alert runbook updates.
- **Dependencies:** DevOps coordination; metrics (T4/T5/T8).

## 6. Documentation & Runbooks

### T11: Ops Runbook Updates *(Owner: Ops – Jamie, Sprint: M4-S3)*
- **Summary:** Update Ops docs covering worker deployment, calendar integrations, and admin processes.
- **Acceptance Criteria:**
  - New section detailing reminder worker setup, env vars, health checks.
  - Guide for enabling calendar integrations and managing OAuth secrets.
  - Admin payout approval runbook with screenshots.
- **Dependencies:** Completion of related features.

### T12: ADR for Background Job Framework *(Owner: Platform – Wei, Sprint: M4-S1)*
- **Summary:** Record decision on BullMQ vs cron, including trade-offs.
- **Acceptance Criteria:**
  - ADR in `docs/decisions/` capturing context, options, decision, consequences.
  - Linked from M4 docs and milestone notes.
- **Dependencies:** T4 investigation.

## 7. Quality Assurance

### T13: API Test Coverage *(Owner: QA – Lina, Sprint: M4-S3)*
- **Summary:** Add Jest unit/e2e tests for new scheduling, rejection, reminder, and payout endpoints.
- **Acceptance Criteria:**
  - Passing tests covering success + failure cases.
  - CI updated to run new suites if necessary.
- **Dependencies:** Corresponding features implemented.

### T14: Playwright Scenarios *(Owner: QA – Lina, Sprint: M4-S3)*
- **Summary:** Add E2E coverage for customer scheduling flow, provider rejection, admin payout approval.
- **Acceptance Criteria:**
  - Tests pass under strict CSP.
  - Fixtures updated with necessary seed data.
  - Documented instructions for running locally.
- **Dependencies:** Web UI features (T2/T7/T8).
