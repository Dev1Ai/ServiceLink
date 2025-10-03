# ServiceLink Operations Runbook

**Version**: 1.0
**Last Updated**: 2025-10-03
**On-Call**: See PagerDuty rotation

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Architecture Overview](#architecture-overview)
3. [Common Issues](#common-issues)
4. [Incident Response](#incident-response)
5. [Deployment Procedures](#deployment-procedures)
6. [Rollback Procedures](#rollback-procedures)
7. [Health Checks](#health-checks)
8. [Database Operations](#database-operations)
9. [Monitoring & Alerts](#monitoring--alerts)
10. [Escalation](#escalation)

---

## Quick Reference

### Service URLs
- **Production API**: https://api.servicelink.com
- **Production Web**: https://servicelink.com
- **Staging API**: https://staging-api.servicelink.com
- **Swagger Docs**: https://api.servicelink.com/docs
- **Grafana**: https://grafana.servicelink.com
- **Sentry**: https://sentry.io/organizations/servicelink

### Key Contacts
- **Engineering Lead**: [Name] - [Phone]
- **DevOps Lead**: [Name] - [Phone]
- **Product Manager**: [Name] - [Phone]
- **Database Admin**: [Name] - [Phone]

### Critical Environment Variables
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=[ROTATE_QUARTERLY]
STRIPE_SECRET_KEY=[PRODUCTION_KEY]
OPENAI_API_KEY=[PRODUCTION_KEY]
CORS_ORIGIN=https://servicelink.com,https://www.servicelink.com
```

---

## Architecture Overview

### Components
1. **NestJS API** (apps/api) - Port 3001
2. **Next.js Web** (apps/web) - Port 3000
3. **PostgreSQL** - Port 5432 (with pgvector extension)
4. **Redis** - Port 6379 (caching, rate limiting, presence)
5. **BullMQ Worker** - Reminder notifications
6. **WebSocket Gateway** - Realtime chat (/ws namespace)

### Data Flow
```
Client → Next.js (SSR/CSR) → NestJS API → PostgreSQL
                                      ↓
                                    Redis
                                      ↓
                                  BullMQ → Reminders
```

### External Dependencies
- **Stripe** - Payments (PaymentIntents, Connect, webhooks)
- **OpenAI** - LLM (GPT-4o), STT (Whisper), RAG (embeddings)
- **Twilio** - SMS notifications
- **Resend** - Email notifications
- **Sentry** - Error tracking
- **PostHog** - Analytics (optional)

---

## Common Issues

### 1. API Returns 500 Errors

**Symptoms**:
- Sentry shows spike in InternalServerError
- Logs show database connection errors

**Diagnosis**:
```bash
# Check API logs
kubectl logs -f deployment/servicelink-api --tail=100

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
```

**Resolution**:
1. If connection pool exhausted (>80 connections):
   ```bash
   # Restart API to reset connections
   kubectl rollout restart deployment/servicelink-api
   ```

2. If database is down:
   ```bash
   # Check RDS status in AWS Console
   # Or restart PostgreSQL container
   docker restart servicelink-postgres
   ```

3. If Prisma migration failed:
   ```bash
   # Check migration status
   pnpm --filter api prisma migrate status

   # Resolve migration issues
   pnpm --filter api prisma migrate resolve --applied <migration_name>
   ```

---

### 2. WebSocket Connections Failing

**Symptoms**:
- Users report chat not working
- Grafana shows WebSocket connection drops
- Logs show "WebSocket handshake failed"

**Diagnosis**:
```bash
# Check WebSocket connections
kubectl exec -it deployment/servicelink-api -- sh
> curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:3001/ws

# Check Redis adapter
redis-cli PING
redis-cli KEYS "socket.io*"
```

**Resolution**:
1. If Redis is down:
   ```bash
   # Restart Redis
   kubectl rollout restart deployment/servicelink-redis
   ```

2. If CORS blocking:
   ```bash
   # Check CORS_ORIGIN env var
   kubectl get deployment/servicelink-api -o yaml | grep CORS_ORIGIN

   # Update if needed
   kubectl set env deployment/servicelink-api \
     CORS_ORIGIN=https://servicelink.com,https://www.servicelink.com
   ```

---

### 3. Rate Limit Blocking Legitimate Users

**Symptoms**:
- User reports "Too many requests" (429)
- Sentry shows spike in 429 errors for specific endpoint

**Diagnosis**:
```bash
# Check rate limit config
env | grep RATE_

# Check Redis rate limit keys
redis-cli KEYS "*throttle*"
redis-cli TTL "throttle:auth:login:user@example.com"
```

**Resolution**:
1. **Temporary fix**: Clear rate limit for user
   ```bash
   redis-cli DEL "throttle:auth:login:user@example.com"
   ```

2. **Permanent fix**: Adjust rate limits
   ```bash
   # Update in deployment
   kubectl set env deployment/servicelink-api AUTH_LOGIN_RATE_LIMIT=20

   # Or adjust role-specific limits
   kubectl set env deployment/servicelink-api AUTH_LOGIN_RATE_LIMIT_CUSTOMER=30
   ```

---

### 4. Stripe Webhooks Failing

**Symptoms**:
- Payments stuck in "processing" state
- Sentry shows "Webhook signature verification failed"
- Stripe dashboard shows webhook retries

**Diagnosis**:
```bash
# Check recent webhook logs
kubectl logs deployment/servicelink-api | grep "stripe/webhook"

# Verify webhook secret
kubectl get secret servicelink-secrets -o jsonpath='{.data.STRIPE_WEBHOOK_SECRET}' | base64 -d
```

**Resolution**:
1. If signature mismatch:
   ```bash
   # Get correct webhook secret from Stripe dashboard
   # Update secret
   kubectl create secret generic servicelink-secrets \
     --from-literal=STRIPE_WEBHOOK_SECRET=whsec_... \
     --dry-run=client -o yaml | kubectl apply -f -

   # Restart API
   kubectl rollout restart deployment/servicelink-api
   ```

2. If webhook endpoint unreachable:
   - Check ingress/ALB configuration
   - Verify `/stripe/webhook` route in main.ts has raw body parser

---

### 5. High Memory Usage / Memory Leak

**Symptoms**:
- API pod OOMKilled (Out of Memory)
- Grafana shows increasing memory trend
- Slow response times

**Diagnosis**:
```bash
# Check current memory usage
kubectl top pods -l app=servicelink-api

# Get heap snapshot (if Node.js debugging enabled)
kubectl exec -it deployment/servicelink-api -- kill -USR2 1
kubectl cp servicelink-api-xyz:/tmp/heap.snapshot ./heap.snapshot

# Analyze with Chrome DevTools or heapdump analyzer
```

**Resolution**:
1. **Immediate**: Restart pod
   ```bash
   kubectl delete pod -l app=servicelink-api
   ```

2. **Short-term**: Increase memory limit
   ```yaml
   # deployment.yaml
   resources:
     limits:
       memory: 2Gi  # Increase from 1Gi
   ```

3. **Long-term**: Fix memory leak
   - Review recent code changes
   - Check for event listener leaks
   - Ensure Prisma client connections are closed
   - Monitor WebSocket connection cleanup

---

### 6. Database Query Performance Degradation

**Symptoms**:
- API response times > 1s (p95)
- Database CPU > 80%
- Logs show slow queries

**Diagnosis**:
```sql
-- Check slow queries (requires pg_stat_statements)
SELECT
  calls,
  mean_exec_time / 1000 AS mean_ms,
  total_exec_time / 1000 AS total_sec,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;

-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Resolution**:
1. Add missing indexes:
   ```sql
   CREATE INDEX CONCURRENTLY idx_quotes_job_provider
   ON "Quote" (jobId, providerId, status);

   CREATE INDEX CONCURRENTLY idx_assignments_status_scheduled
   ON "Assignment" (status, scheduledStart)
   WHERE status IN ('scheduled', 'in_progress');
   ```

2. Run VACUUM:
   ```sql
   VACUUM ANALYZE "Job";
   VACUUM ANALYZE "Quote";
   VACUUM ANALYZE "Assignment";
   ```

3. Fix N+1 queries in code (see apps/api/src/jobs/jobs.service.ts)

---

## Incident Response

### Severity Levels

| Level | Response Time | Description | Examples |
|-------|---------------|-------------|----------|
| **P0 - Critical** | 15 min | Service down, data loss, security breach | API completely down, database breach |
| **P1 - High** | 1 hour | Major feature broken, affecting >50% users | Payments failing, auth broken |
| **P2 - Medium** | 4 hours | Feature degraded, affecting <50% users | Search slow, some WebSocket issues |
| **P3 - Low** | 1 business day | Minor issue, workaround available | UI bug, non-critical API error |

### Incident Response Flow

1. **Acknowledge** (within response time)
   - Page on-call engineer
   - Create incident in PagerDuty
   - Post in #incidents Slack channel

2. **Assess** (5-10 minutes)
   - Check Grafana dashboards
   - Review Sentry errors
   - Check external status (Stripe, OpenAI)
   - Determine severity and scope

3. **Mitigate** (immediately)
   - Apply quick fix (restart, rollback, feature flag)
   - Update incident status
   - Communicate ETA to users (if P0/P1)

4. **Resolve** (within SLA)
   - Implement permanent fix
   - Verify resolution in staging
   - Deploy to production
   - Monitor for 30 minutes

5. **Post-Mortem** (within 48 hours for P0/P1)
   - Document root cause
   - List action items
   - Update runbook
   - Schedule team review

---

## Deployment Procedures

### Pre-Deployment Checklist
- [ ] All tests passing in CI
- [ ] Staging deployment successful
- [ ] Database migrations tested
- [ ] Feature flags configured
- [ ] Rollback plan documented
- [ ] On-call engineer available

### Deployment Steps

```bash
# 1. Deploy database migrations (if any)
kubectl exec -it deployment/servicelink-api -- sh
pnpm --filter api prisma migrate deploy

# 2. Deploy API (rolling update)
kubectl set image deployment/servicelink-api \
  api=servicelink/api:v1.2.3

# Watch rollout
kubectl rollout status deployment/servicelink-api

# 3. Deploy Web (blue-green)
# Update target group to point to new ASG
aws elbv2 modify-rule --rule-arn <rule-arn> \
  --actions Type=forward,TargetGroupArn=<new-tg-arn>

# 4. Verify health
curl -f https://api.servicelink.com/health || echo "FAILED"
curl -f https://servicelink.com || echo "FAILED"

# 5. Monitor for 15 minutes
# Watch Grafana, Sentry, logs for anomalies
```

### Post-Deployment Verification

```bash
# Run smoke tests
pnpm --filter api test:e2e

# Check key metrics
# - Error rate < 1%
# - p95 latency < 500ms
# - Database connections < 70%
# - Memory usage stable
```

---

## Rollback Procedures

See [ROLLBACK.md](./ROLLBACK.md) for detailed procedures.

### Quick Rollback (API)

```bash
# Rollback to previous version
kubectl rollout undo deployment/servicelink-api

# Or rollback to specific revision
kubectl rollout history deployment/servicelink-api
kubectl rollout undo deployment/servicelink-api --to-revision=5

# Verify rollback
kubectl rollout status deployment/servicelink-api
```

### Quick Rollback (Database Migration)

```bash
# Mark migration as rolled back
pnpm --filter api prisma migrate resolve --rolled-back <migration_name>

# Apply down migration (if exists)
psql $DATABASE_URL < prisma/migrations/<migration_name>/down.sql
```

---

## Health Checks

### API Health Endpoint
```bash
curl https://api.servicelink.com/health

# Expected response:
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2025-10-03T10:30:00Z"
}
```

### Database Health
```sql
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

### Redis Health
```bash
redis-cli PING  # Should return PONG
redis-cli INFO memory | grep used_memory_human
redis-cli INFO stats | grep total_commands_processed
```

---

## Monitoring & Alerts

### Key Dashboards
1. **API Overview** - Request rate, latency, errors
2. **Database Performance** - Query time, connections, locks
3. **WebSocket Metrics** - Active connections, message rate
4. **Business Metrics** - Jobs created, quotes accepted, payments

### Alert Rules (Slack #alerts)
- **High Error Rate**: >5% errors for 2 minutes
- **Slow Responses**: p95 > 1s for 5 minutes
- **Database Issues**: Connection pool >90% for 1 minute
- **Memory Leak**: Memory growth >100MB/hour
- **WebSocket Down**: <80% connection success for 3 minutes

---

## Escalation

### Level 1: On-Call Engineer
- Handles P2/P3 incidents
- Initial response for P0/P1

### Level 2: Engineering Lead
- Escalate P0/P1 if not resolved in 30 minutes
- Complex database/architecture issues

### Level 3: CTO / Vendor Support
- Security incidents
- Third-party outages (Stripe, OpenAI, AWS)
- Major architectural decisions

### External Vendor Contacts
- **Stripe Support**: support@stripe.com (P1: call +1-888-926-2289)
- **OpenAI Support**: support@openai.com
- **AWS Support**: Create ticket in AWS Console (Business Support)

---

## Appendix

### Useful Commands

```bash
# Get API logs
kubectl logs -f deployment/servicelink-api --tail=100

# Get database connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Clear Redis cache
redis-cli FLUSHDB

# Check Prisma migration status
pnpm --filter api prisma migrate status

# Run database backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore database
psql $DATABASE_URL < backup-20251003-103000.sql
```

### Related Documentation
- [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) - Security best practices
- [LOAD-TESTING.md](./LOAD-TESTING.md) - Performance testing guide
- [ROLLBACK.md](./ROLLBACK.md) - Detailed rollback procedures
- [PLAYBOOK.md](./PLAYBOOK.md) - Development playbook
