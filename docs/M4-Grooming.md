# Milestone M4 — Sprint S1 Grooming Notes

## Overview

Sprint M4-S1 backlog: T1, T2, T4, T12.
This doc captures clarification needs, data contracts, and preparation tasks before sprint kickoff.

## T1 – Assignment Schema Expansion

- **Data Model Draft**
  - `scheduledStart` / `scheduledEnd` (`DateTime`, nullable)
  - `scheduleProposedBy` (`enum`: `CUSTOMER`, `PROVIDER`, `SYSTEM`)
  - `scheduleVersion` (`Int`, default 0)
  - `scheduleNotes` (`String`, nullable)
  - `rejectedAt` (`DateTime`, nullable)
  - `reminderStatus` (`enum`: `NONE`, `QUEUED`, `SENT`, `OVERDUE`)
  - `reminderLastSentAt` (`DateTime`, nullable)
  - `payoutStatus` (`enum`: `PENDING`, `AWAITING_APPROVAL`, `APPROVED`, `PAID`, `BLOCKED`)
  - `payoutApprovedBy` (`String`, nullable user id)
  - `payoutApprovedAt` (`DateTime`, nullable)
- **Questions to Confirm**
  1. Do we need per-assignment `timezone` or rely on provider/customer profiles?
  2. Should `scheduleVersion` increment on every propose/confirm/reject event?
- **Pre-work**
  - Prepare Prisma migration draft and share for review.
  - Review existing API/unit tests touching `assignment` to scope updates.

## T2 – Scheduling Endpoints

- **Contract Sketch**
  - `POST /jobs/:id/schedule` body:
    ```json
    { "start": "ISO", "end": "ISO", "notes": "optional" }
    ```
  - `POST /assignments/:id/schedule` same shape, requires provider role.
  - `POST /assignments/:id/schedule/confirm` body optional (acknowledge latest proposal).
  - `POST /assignments/:id/reject` body `{ "reason": "string" }`.
- **Validation Rules**
  - Windows must be within next 60 days (env configurable).
  - `end` > `start` by at least 30 min.
  - Reject reason required when provider rejects.
- **Dependencies**
  - T1 fields available; notifications contract from T6 (draft event payloads now).
- **Open Items**
  - Confirm requeue logic: does rejection re-open quotes or auto-invite next provider queue?
  - Determine audit trail: log schedule events in new `AssignmentTimeline` table?

## T4 – Background Worker Foundation

- Prepare ADR outline (ties to T12).
- Inventory existing Redis usage; check DB credentials for worker environment.
- Draft health endpoint spec (`/workers/reminders/health`).

## T12 – Background Job Framework ADR

- Collect comparison notes (BullMQ vs Bree vs node-cron).
- Identify production support considerations (retry semantics, visibility).
- Schedule 30-min tech review (target before sprint planning).

## Action Items Before Sprint

- [ ] Product sign-off on new assignment enum values.
- [ ] DB migration spike (Alex) — provide diff for review.
- [ ] API contract review with mobile (Priya to sync with mobile lead).
- [ ] DevOps capacity check for Redis queues (Sam).
- [ ] Schedule ADR review meeting (Wei).
