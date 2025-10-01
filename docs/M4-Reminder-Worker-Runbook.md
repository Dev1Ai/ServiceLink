# M4 Reminder Worker Runbook

This runbook explains how to operate the assignment reminder worker that powers automated nudges for scheduled jobs. The worker lives inside the API service (via the `RemindersModule`) and uses BullMQ + Redis to queue reminder jobs.

## 1. Architecture Overview
- **Queue backend:** BullMQ with Redis (`REDIS_URL`).
- **Dispatcher:** `RemindersService` scans Prisma for scheduled assignments whose `reminderStatus` is `NONE`, then enqueues `assignment-reminder` jobs.
- **Worker:** Processes jobs inline (same Node process) and calls `NotificationsService.notifyAssignmentReminder` before updating `reminderStatus` to `SENT`.
- **Metrics:** Prometheus counters `reminder_sent_total{status}` and `reminder_failed_total{reason}`.
- **Logging:** Structured logs on queue init, enqueue actions, skips (version mismatch/status), and failures.

## 2. Configuration
Set via environment variables (see `.env.example`). Default values work for local dev.

| Variable | Purpose | Default |
| - | - | - |
| `REMINDER_WORKER_ENABLED` | Toggle entire worker (set to `false` to disable) | `true` |
| `REMINDER_LEAD_MINUTES` | Minutes before `scheduledStart` to send reminder | `30` |
| `REMINDER_LOOKAHEAD_MINUTES` | Window to look ahead when scanning | `120` |
| `REMINDER_OVERDUE_MINUTES` | Minutes past `scheduledStart` before marking `OVERDUE` | `30` |
| `REMINDER_POLL_INTERVAL_MS` | Interval between scans (ms) | `300000` (5 min) |
| `REMINDER_WORKER_CONCURRENCY` | BullMQ worker concurrency | `2` |
| `REDIS_URL` | Redis connection string (required when enabled) | `redis://localhost:6379` |

## 3. Local Operation
1. Ensure Redis is running (e.g. `docker compose up redis`).
2. Run `pnpm dev` (API starts the worker automatically).
3. Seed data (`pnpm db:seed`) and create scheduled assignments; reminders will enqueue automatically.
4. Inspect queue state:
   ```bash
   pnpm --filter api exec ts-node -e "const { Queue } = require('bullmq'); const queue = new Queue('assignment-reminders', { connection: { host: '127.0.0.1', port: 6379 } }); queue.getJobs(['waiting','delayed']).then(jobs => console.log(jobs.length) && process.exit());"
   ```

## 4. Deployment Checklist
- **Environment:** Set `REDIS_URL` and reminder env vars in the target environment (e.g. Render, Fly.io).
- **Secrets:** Provide Redis credentials through platform secrets manager.
- **Release:** API deployment automatically initialises the worker; no separate process needed.
- **Smoke test:** After deploy run `GET /api/metrics` (or the Prometheus scrape endpoint) and confirm the counters exist.

## 5. Health & Monitoring
- **Metrics:**
  - `reminder_sent_total{status}` increments per successful reminder. Expect at least one `status="SCHEDULED"` per matched assignment.
  - `reminder_failed_total{reason}` covers enqueue/worker failures. Alert when `increase(...)` over 15m > 0.
- **Logs:** Search for `Reminder queue initialised`, `Queued reminder`, `Reminder job skipped`, and `Failed to queue reminder`.
- **Redis:** monitor connection health and memory. Stalled connections will surface as worker failures.

## 6. Alerting Recommendations
- Trigger PagerDuty/Slack when `reminder_failed_total` increases or `reminder_sent_total` stays flat while assignments remain scheduled.
- Alert if `reminder_overdue` count on Ops dashboard crosses threshold (e.g. >10).

## 7. Recovery Procedures
1. **Worker disabled/inactive:** Check `REMINDER_WORKER_ENABLED`. If `false`, flip to `true` and redeploy.
2. **Redis outage:** Set `REMINDER_WORKER_ENABLED=false` temporarily to avoid noisy logs, restore Redis, then re-enable and deploy.
3. **Jobs stuck queued:** Manually inspect via `queue.getJobs(['delayed','waiting'])` and clear using `queue.removeJobs('*')` if appropriate. After manual adjustments call `scanAndEnqueue` via `/api/admin/reminders/rescan` (TODO future endpoint) or restart API to trigger initial scan.
4. **Assignments out of sync:** If reminder status is wrong, run manual SQL/Prisma script:
   ```bash
   pnpm --filter api exec ts-node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.assignment.updateMany({ where: { status: 'scheduled', reminderStatus: 'SENT', scheduledStart: { gt: new Date() } }, data: { reminderStatus: 'NONE' } }).then(console.log).finally(() => prisma.$disconnect());"
   ```

## 8. Runbook Verification List
- [ ] Redis URL configured and reachable.
- [ ] Prometheus scraping `reminder_*` counters.
- [ ] Alert rules in place for `reminder_failed_total` and dashboard tiles show reminder status counts.
- [ ] Operator aware of disable switch and recovery steps.

Keep this document alongside Ops onboarding so new team members can rapidly diagnose reminder automation issues.
