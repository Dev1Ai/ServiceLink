# Rollback Procedures - ServiceLink

**Version**: 1.0
**Last Updated**: 2025-10-03

## Quick Reference

| Component | Rollback Time | Complexity | Risk Level |
|-----------|---------------|------------|------------|
| API (Code only) | 2-3 minutes | Low | Low |
| Web (Next.js) | 3-5 minutes | Low | Low |
| Database Migration | 5-15 minutes | High | **High** |
| Feature Flag | 30 seconds | Very Low | Very Low |
| Full Stack | 10-20 minutes | Medium | Medium |

---

## Table of Contents
1. [Pre-Rollback Checklist](#pre-rollback-checklist)
2. [API Rollback](#api-rollback)
3. [Web Rollback](#web-rollback)
4. [Database Migration Rollback](#database-migration-rollback)
5. [Feature Flag Rollback](#feature-flag-rollback)
6. [Full Stack Rollback](#full-stack-rollback)
7. [Emergency Procedures](#emergency-procedures)
8. [Post-Rollback Tasks](#post-rollback-tasks)

---

## Pre-Rollback Checklist

Before initiating any rollback:

- [ ] **Identify the issue**: Confirm rollback is necessary
- [ ] **Notify team**: Post in #incidents Slack channel
- [ ] **Create incident ticket**: Document in PagerDuty or Jira
- [ ] **Identify target version**: Determine last known good version
- [ ] **Check dependencies**: Verify no downstream impacts
- [ ] **Backup current state**: Capture logs, metrics, database snapshot
- [ ] **Alert stakeholders**: Notify product team if user-facing

---

## API Rollback

### Kubernetes Deployment Rollback

**When to use**: Bad API code deployment, performance regression, new bugs

#### Steps

```bash
# 1. Check deployment history
kubectl rollout history deployment/servicelink-api

# Output example:
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update to v1.2.3
# 3         Update to v1.2.4 (current - BAD)

# 2. Rollback to previous version (v1.2.3)
kubectl rollout undo deployment/servicelink-api

# Or rollback to specific revision
kubectl rollout undo deployment/servicelink-api --to-revision=2

# 3. Monitor rollback progress
kubectl rollout status deployment/servicelink-api

# Expected output: "deployment "servicelink-api" successfully rolled out"

# 4. Verify health
curl -f https://api.servicelink.com/health
curl -f https://api.servicelink.com/docs  # Swagger should load
```

#### Verification

```bash
# Check pod version
kubectl get pods -l app=servicelink-api -o jsonpath='{.items[0].spec.containers[0].image}'

# Check logs for errors
kubectl logs -l app=servicelink-api --tail=50 | grep -i error

# Run smoke test
curl -X POST https://api.servicelink.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

**Expected completion time**: 2-3 minutes

---

## Web Rollback

### Next.js Static Site Rollback

**When to use**: UI bugs, CSP issues, broken client-side routing

#### Option 1: Blue-Green Deployment Rollback (Recommended)

```bash
# 1. Identify current and previous target groups
aws elbv2 describe-target-groups \
  --names servicelink-web-v124 servicelink-web-v123

# 2. Switch ALB to previous target group
aws elbv2 modify-listener --listener-arn <listener-arn> \
  --default-actions Type=forward,TargetGroupArn=<previous-tg-arn>

# 3. Verify switch
curl -I https://servicelink.com | grep -i x-version
# Should show previous version number
```

**Expected completion time**: 30 seconds

#### Option 2: Vercel/Static Host Rollback

```bash
# Vercel CLI
vercel rollback <deployment-url>

# Or via dashboard: vercel.com → deployments → promote previous

# CloudFront + S3
aws cloudfront create-invalidation \
  --distribution-id <dist-id> \
  --paths "/*"
```

**Expected completion time**: 3-5 minutes (including CDN propagation)

#### Verification

```bash
# Check web loads
curl -f https://servicelink.com

# Test critical flows
# 1. Auth flow
# 2. Job creation
# 3. Provider search
# 4. WebSocket connection
```

---

## Database Migration Rollback

⚠️ **WARNING**: Database rollbacks are **HIGH RISK** and may cause **DATA LOSS**.

### Risk Assessment Matrix

| Migration Type | Rollback Risk | Data Loss Risk | Recommended Action |
|----------------|---------------|----------------|-------------------|
| Add column | Low | None | Safe to rollback |
| Add table | Low | Possible (new data) | Safe if table unused |
| Modify column | **High** | **Likely** | Requires careful planning |
| Drop column | **Critical** | **Guaranteed** | **DO NOT ROLLBACK** (restore from backup) |
| Drop table | **Critical** | **Guaranteed** | **DO NOT ROLLBACK** (restore from backup) |

### Safe Rollback (Add Column/Table)

```bash
# 1. Check migration status
pnpm --filter api prisma migrate status

# 2. Mark migration as rolled back in Prisma
pnpm --filter api prisma migrate resolve --rolled-back <migration_name>

# 3. Run down migration SQL (if exists)
psql $DATABASE_URL < prisma/migrations/<migration_name>/down.sql

# Example down.sql for adding column:
# ALTER TABLE "Job" DROP COLUMN IF EXISTS "newColumn";
```

**Expected completion time**: 1-2 minutes

### Complex Rollback (Modify Column)

**Scenario**: Changed column type from `String` to `Int`, need to rollback

```sql
-- 1. Backup affected table
CREATE TABLE "Job_backup_20251003" AS SELECT * FROM "Job";

-- 2. Check data compatibility
SELECT COUNT(*) FROM "Job" WHERE "columnName"::text !~ '^[0-9]+$';
-- If count > 0, data will be lost during rollback

-- 3. Create rollback script
ALTER TABLE "Job" ALTER COLUMN "columnName" TYPE TEXT;

-- 4. Run rollback
psql $DATABASE_URL < rollback.sql

-- 5. Verify data integrity
SELECT COUNT(*) FROM "Job";
SELECT COUNT(*) FROM "Job_backup_20251003";
-- Counts should match
```

**Expected completion time**: 5-10 minutes (depending on table size)

### Critical Rollback (Drop Column/Table)

⚠️ **DO NOT attempt to rollback DROP operations**

Instead:

1. **Restore from backup**:
   ```bash
   # Stop all writes to database
   kubectl scale deployment/servicelink-api --replicas=0

   # Restore from latest backup
   pg_restore -d $DATABASE_URL backup-20251003-083000.dump

   # Restart API
   kubectl scale deployment/servicelink-api --replicas=3
   ```

2. **Or use point-in-time recovery** (if RDS):
   ```bash
   # AWS Console → RDS → Restore to point in time
   # Select time before bad migration
   # Create new instance, update DATABASE_URL
   ```

**Expected completion time**: 15-30 minutes (depending on database size)

### Migration Rollback Checklist

- [ ] **Assess data loss risk** using matrix above
- [ ] **Create database backup** before rollback
- [ ] **Stop application writes** if modifying critical tables
- [ ] **Run rollback script** in transaction
- [ ] **Verify data integrity** with count/sum checks
- [ ] **Update Prisma schema** to match rolled-back state
- [ ] **Regenerate Prisma client**: `pnpm --filter api prisma generate`
- [ ] **Test application** against rolled-back schema

---

## Feature Flag Rollback

**When to use**: Gradual feature rollout, A/B testing, emergency kill switch

### LaunchDarkly Example

```bash
# Toggle feature flag off via CLI
curl -X PATCH https://app.launchdarkly.com/api/v2/flags/default/new-payment-flow \
  -H "Authorization: <LD_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"patch": [{"op": "replace", "path": "/environments/production/on", "value": false}]}'

# Or use dashboard: launchdarkly.com → Feature Flags → Toggle off
```

### Environment Variable Feature Flag

```bash
# Update feature flag env var
kubectl set env deployment/servicelink-api ENABLE_NEW_QUOTES_FLOW=false

# Restart required for env var changes
kubectl rollout restart deployment/servicelink-api
```

**Expected completion time**: 30 seconds (LaunchDarkly), 2 minutes (env var)

---

## Full Stack Rollback

**When to use**: Coordinated release failed, multiple components broken

### Coordinated Rollback Sequence

```bash
# 1. Stop new traffic (optional - for critical issues)
kubectl scale deployment/servicelink-api --replicas=0

# 2. Rollback database (if migration exists)
pnpm --filter api prisma migrate resolve --rolled-back <migration_name>
psql $DATABASE_URL < prisma/migrations/<migration_name>/down.sql

# 3. Rollback API
kubectl rollout undo deployment/servicelink-api
kubectl rollout status deployment/servicelink-api

# 4. Rollback Web
aws elbv2 modify-listener --listener-arn <listener-arn> \
  --default-actions Type=forward,TargetGroupArn=<previous-web-tg-arn>

# 5. Resume traffic (if stopped)
kubectl scale deployment/servicelink-api --replicas=3

# 6. Verify end-to-end
curl -X POST https://api.servicelink.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

open https://servicelink.com
# Manually test: login → create job → search providers
```

**Expected completion time**: 10-20 minutes

---

## Emergency Procedures

### Circuit Breaker: Kill Switch

**Scenario**: Critical bug affecting all users, need immediate mitigation

```bash
# Option 1: Scale API to 0 (complete outage)
kubectl scale deployment/servicelink-api --replicas=0

# Option 2: Enable maintenance mode
kubectl set env deployment/servicelink-api MAINTENANCE_MODE=true
kubectl rollout restart deployment/servicelink-api

# Option 3: Redirect to static maintenance page
aws elbv2 modify-listener --listener-arn <listener-arn> \
  --default-actions Type=fixed-response,FixedResponseConfig='{StatusCode=503,ContentType=text/html,MessageBody=<h1>Under Maintenance</h1>}'
```

### Data Corruption Recovery

**Scenario**: Bad migration corrupted data, need point-in-time restore

```bash
# 1. Identify corruption time window
psql $DATABASE_URL -c "SELECT created_at FROM \"Job\" WHERE <corruption_check> LIMIT 10"

# 2. Stop all writes
kubectl scale deployment/servicelink-api --replicas=0

# 3. Restore from backup (RDS)
# AWS Console → RDS → servicelink-db → Actions → Restore to point in time
# Select timestamp before corruption
# Restore to new instance: servicelink-db-restored

# 4. Update DATABASE_URL to restored instance
kubectl set env deployment/servicelink-api \
  DATABASE_URL=postgresql://user:pass@servicelink-db-restored:5432/servicelink

# 5. Verify data integrity
psql <new-db-url> -c "SELECT COUNT(*) FROM \"Job\""
psql <new-db-url> -c "SELECT COUNT(*) FROM \"Quote\""

# 6. Resume service
kubectl scale deployment/servicelink-api --replicas=3
```

**Expected completion time**: 20-45 minutes (depending on database size)

---

## Post-Rollback Tasks

After successful rollback:

### Immediate (Within 1 Hour)

- [ ] **Verify system health**: Check Grafana dashboards
- [ ] **Monitor error rates**: Ensure <1% error rate for 15 minutes
- [ ] **Test critical flows**: Auth, job creation, payments
- [ ] **Update incident ticket**: Document rollback completion
- [ ] **Notify stakeholders**: Post in #incidents, email product team

### Short-Term (Within 24 Hours)

- [ ] **Root cause analysis**: Identify what went wrong
- [ ] **Update tests**: Add test coverage for bug that caused rollback
- [ ] **Fix forward**: Create hotfix branch, PR, and deploy
- [ ] **Update documentation**: Add learnings to runbook

### Long-Term (Within 1 Week)

- [ ] **Post-mortem meeting**: Review incident with team
- [ ] **Action items**: Assign owners and due dates
- [ ] **Process improvements**: Update deployment checklist
- [ ] **Monitoring enhancements**: Add alerts to catch issue earlier

---

## Rollback Decision Matrix

| Symptom | Severity | Recommended Action | Rollback Type |
|---------|----------|-------------------|---------------|
| API 500 errors >10% | P0 | Immediate rollback | API only |
| UI completely broken | P0 | Immediate rollback | Web only |
| Payment failures | P0 | Feature flag off + API rollback | Feature flag → API |
| Slow queries (>2s p95) | P1 | DB migration rollback | Database |
| WebSocket disconnects | P1 | API rollback | API only |
| Minor UI bug | P2 | Fix forward, no rollback | None |
| Non-critical feature broken | P2 | Feature flag off | Feature flag |

---

## Rollback Testing (Staging)

Practice rollbacks quarterly in staging:

```bash
# 1. Deploy "bad" version to staging
kubectl set image deployment/servicelink-api-staging api=servicelink/api:v1.2.4-bad

# 2. Trigger issue (e.g., call failing endpoint)
curl https://staging-api.servicelink.com/broken-endpoint

# 3. Practice rollback
kubectl rollout undo deployment/servicelink-api-staging

# 4. Verify recovery
curl https://staging-api.servicelink.com/health

# 5. Document any issues in rollback procedure
```

---

## Contact Information

### Rollback Authority

| Severity | Who Can Authorize | Response Time |
|----------|-------------------|---------------|
| P0 | On-call engineer (immediate) | 0 min |
| P1 | Engineering lead | 15 min |
| P2 | Product manager + engineering | 1 hour |
| P3 | Normal review process | N/A |

### Emergency Contacts

- **On-Call Engineer**: Check PagerDuty rotation
- **Engineering Lead**: [Name] - [Phone]
- **Database Admin**: [Name] - [Phone]
- **DevOps Lead**: [Name] - [Phone]

---

## Related Documentation

- [RUNBOOK.md](./RUNBOOK.md) - Operations runbook
- [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) - Security procedures
- [LOAD-TESTING.md](./LOAD-TESTING.md) - Performance testing
- [PLAYBOOK.md](./PLAYBOOK.md) - Development playbook
