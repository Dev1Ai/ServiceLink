# ServiceLink Deployment Guide

**Version**: 1.0
**Last Updated**: 2025-10-03
**Target**: Production deployment on cloud infrastructure

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- **Node.js**: v18+ (LTS recommended)
- **pnpm**: v9+
- **Docker**: v24+ (for local testing)
- **PostgreSQL**: v15+ with pgvector extension
- **Redis**: v7+
- **Git**: v2.40+

### Required Accounts
- **Stripe**: Live account with Connect enabled
- **OpenAI**: API access with GPT-4o and Whisper
- **AWS** (or alternative): RDS, ElastiCache, S3, CloudFront
- **Vercel/Netlify**: For Next.js web app (or self-host)
- **Domain**: SSL certificate (Let's Encrypt or AWS ACM)

### Access Requirements
- **Database Admin**: Superuser access to create extensions
- **DNS Management**: Ability to configure A/CNAME records
- **SSL Certificates**: Valid certificates for API and Web domains

---

## Infrastructure Setup

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         v                            v
┌────────────────┐          ┌────────────────┐
│   CloudFront   │          │  Load Balancer │
│   (Web CDN)    │          │   (API ALB)    │
└────────┬───────┘          └────────┬───────┘
         │                            │
         v                            v
┌────────────────┐          ┌────────────────┐
│  Vercel/S3     │          │   ECS/K8s      │
│  (Next.js)     │          │   (NestJS API) │
└────────────────┘          └────────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    v                v                v
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │   RDS    │    │  Redis   │    │  BullMQ  │
              │ Postgres │    │ (Cache)  │    │ Worker   │
              └──────────┘    └──────────┘    └──────────┘
```

### AWS Resources (Recommended)

#### 1. RDS PostgreSQL
```bash
# Database Configuration
Instance Class: db.t3.medium (minimum)
Storage: 100GB GP3 SSD (autoscaling enabled)
Multi-AZ: Yes (for production)
Backup: Automated daily backups, 7-day retention
Version: PostgreSQL 15.x with pgvector extension
```

#### 2. ElastiCache Redis
```bash
# Cache Configuration
Node Type: cache.t3.medium
Cluster Mode: Disabled (for simplicity)
Replicas: 1 (for high availability)
Snapshot Retention: 5 days
```

#### 3. ECS/Fargate (API)
```bash
# Container Configuration
CPU: 1 vCPU (scale to 4 vCPU under load)
Memory: 2GB (scale to 8GB under load)
Tasks: 2 minimum, 10 maximum (auto-scaling)
Health Check: /health endpoint
```

#### 4. S3 + CloudFront (Web - if self-hosting)
```bash
# Static Site Hosting
S3 Bucket: servicelink-web-prod
CloudFront Distribution: With SSL certificate
Cache: 1 hour for static assets, no cache for HTML
```

---

## Environment Configuration

### API Environment Variables (.env.production)

```bash
# ---- Core ----
NODE_ENV=production
PORT=3001

# ---- Database / Cache ----
DATABASE_URL=postgresql://user:pass@servicelink-db.region.rds.amazonaws.com:5432/servicelink
REDIS_URL=redis://servicelink-cache.region.cache.amazonaws.com:6379

# ---- Auth / Identity ----
JWT_SECRET=<32-byte-cryptographically-random-string>
# Generate: openssl rand -base64 32

# ---- CORS ----
# CRITICAL: Set this to your actual web domain
CORS_ORIGIN=https://servicelink.com,https://www.servicelink.com

# ---- Payments (Stripe Live Keys) ----
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_RETURN_URL=https://servicelink.com/provider/onboarding/completed
STRIPE_REFRESH_URL=https://servicelink.com/provider/onboarding/refresh

# ---- AI / LLM / STT ----
OPENAI_API_KEY=sk-proj-...
WHISPER_MODE=api

# ---- Notifications ----
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_NUMBER=+1555...

# ---- Observability ----
SENTRY_DSN=https://...@sentry.io/...
OTEL_EXPORTER_OTLP_ENDPOINT=https://...

# ---- Reminder Worker ----
REMINDER_WORKER_ENABLED=true
REMINDER_LEAD_MINUTES=30
REMINDER_LOOKAHEAD_MINUTES=120
REMINDER_OVERDUE_MINUTES=30
REMINDER_POLL_INTERVAL_MS=300000
REMINDER_WORKER_CONCURRENCY=2

# ---- Rate Limiting (Production Values) ----
AUTH_LOGIN_RATE_LIMIT=10
JOBS_RATE_LIMIT_CUSTOMER=10
QUOTES_RATE_LIMIT=5
SEARCH_RATE_LIMIT=30
WS_CHAT_RATE_LIMIT=15
```

### Web Environment Variables (.env.production)

```bash
# ---- Next.js ----
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://api.servicelink.com

# ---- Security ----
ENABLE_STRICT_CSP=true
# CSP_ALLOW_HTTP=false  # Commented out for production

# ---- Analytics (Optional) ----
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Database Setup

### 1. Install pgvector Extension

```sql
-- Connect to RDS with superuser privileges
-- Create pgvector extension for RAG features
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

### 2. Run Prisma Migrations

```bash
# From apps/api directory
pnpm prisma migrate deploy

# Verify migration status
pnpm prisma migrate status
```

### 3. Seed Initial Data (Optional)

```bash
# Seed categories, sample users, etc.
pnpm prisma db seed

# Or run custom seed script
pnpm seed:production
```

### 4. Database Indexes (Performance)

```sql
-- Additional indexes for production performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotes_status_created
ON "Quote" (status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_customer_status
ON "Job" ("customerId", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_provider_status
ON "Assignment" ("providerId", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_ratee_created
ON "Review" ("rateeUserId", "createdAt" DESC);
```

---

## Application Deployment

### Option 1: AWS ECS (Recommended)

#### Build Docker Image

```dockerfile
# apps/api/Dockerfile.production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter api build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

#### Deploy to ECS

```bash
# 1. Build and push image
docker build -t servicelink-api:latest -f apps/api/Dockerfile.production .
docker tag servicelink-api:latest <aws-account>.dkr.ecr.<region>.amazonaws.com/servicelink-api:latest
aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-url>
docker push <aws-account>.dkr.ecr.<region>.amazonaws.com/servicelink-api:latest

# 2. Update ECS service
aws ecs update-service \
  --cluster servicelink-prod \
  --service servicelink-api \
  --force-new-deployment
```

### Option 2: Kubernetes (Advanced)

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: servicelink-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: servicelink-api
  template:
    metadata:
      labels:
        app: servicelink-api
    spec:
      containers:
      - name: api
        image: servicelink-api:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: servicelink-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: servicelink-secrets
              key: redis-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### Web Deployment (Vercel)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Link project
cd apps/web
vercel link

# 3. Set environment variables
vercel env add NEXT_PUBLIC_API_BASE_URL production
# Enter: https://api.servicelink.com

vercel env add ENABLE_STRICT_CSP production
# Enter: true

# 4. Deploy to production
vercel --prod
```

---

## Post-Deployment Verification

### Health Checks

```bash
# API Health
curl https://api.servicelink.com/health
# Expected: {"status":"ok","database":"connected","redis":"connected",...}

# Web Health
curl https://servicelink.com
# Expected: 200 OK with HTML

# Swagger Docs
curl https://api.servicelink.com/docs
# Expected: 200 OK with Swagger UI
```

### Smoke Tests

```bash
# 1. User Signup
curl -X POST https://api.servicelink.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User","role":"customer"}'

# 2. Login
curl -X POST https://api.servicelink.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# 3. Create Job (with token)
curl -X POST https://api.servicelink.com/jobs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Job","description":"Smoke test"}'

# 4. Search Providers
curl "https://api.servicelink.com/providers/search?q=cleaning&page=1&take=10"
```

### Database Verification

```sql
-- Check connection pool
SELECT count(*) FROM pg_stat_activity WHERE datname = 'servicelink';
-- Should be < 80% of max_connections

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Check recent activity
SELECT count(*) FROM "Job" WHERE "createdAt" > NOW() - INTERVAL '1 hour';
SELECT count(*) FROM "Quote" WHERE "createdAt" > NOW() - INTERVAL '1 hour';
```

---

## Monitoring Setup

### 1. Application Metrics (Prometheus + Grafana)

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'servicelink-api'
    static_configs:
      - targets: ['api.servicelink.com:3001']
    metrics_path: '/metrics'
```

### 2. Error Tracking (Sentry)

Already configured in `apps/api/src/main.ts`:
```typescript
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}
```

### 3. Log Aggregation (CloudWatch / Datadog)

```bash
# AWS CloudWatch Logs
# Configure log group: /aws/ecs/servicelink-api
# Retention: 30 days

# Log to CloudWatch from ECS
awslogs-group: /aws/ecs/servicelink-api
awslogs-region: us-east-1
awslogs-stream-prefix: api
```

### 4. Uptime Monitoring (Pingdom / UptimeRobot)

Monitor these endpoints:
- https://api.servicelink.com/health (every 1 min)
- https://servicelink.com (every 1 min)
- https://api.servicelink.com/docs (every 5 min)

Alert on:
- Response time > 2 seconds
- Status code != 200
- 3 consecutive failures

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failures

```bash
# Check database connectivity
telnet <rds-endpoint> 5432

# Check security group rules
aws ec2 describe-security-groups --group-ids <sg-id>

# Test connection string
psql $DATABASE_URL -c "SELECT 1"
```

**Fix**: Update security group to allow inbound traffic from ECS tasks

#### 2. CORS Errors

**Symptom**: Browser console shows "CORS policy" error

**Fix**: Ensure `CORS_ORIGIN` environment variable is set correctly:
```bash
CORS_ORIGIN=https://servicelink.com,https://www.servicelink.com
```

Restart API service after updating.

#### 3. Stripe Webhooks Failing

**Symptom**: Payments stuck in "processing" state

**Fix**:
1. Verify webhook endpoint is publicly accessible
2. Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Ensure `/stripe/webhook` route has raw body parser

```bash
# Test webhook locally
stripe listen --forward-to https://api.servicelink.com/stripe/webhook
```

#### 4. High Memory Usage

**Symptom**: API pods restarting with OOM errors

**Fix**:
1. Increase memory limit in ECS task definition
2. Check for memory leaks with heap snapshots
3. Enable Node.js garbage collection logging

```bash
# Add to container env
NODE_OPTIONS=--max-old-space-size=1536 --expose-gc
```

#### 5. WebSocket Connection Drops

**Symptom**: Realtime chat disconnects frequently

**Fix**:
1. Increase ALB idle timeout (default 60s → 300s)
2. Check Redis connection stability
3. Ensure `sticky sessions` enabled on load balancer

---

## Rollback Procedure

See [ROLLBACK.md](./ROLLBACK.md) for detailed procedures.

**Quick Rollback**:
```bash
# ECS
aws ecs update-service \
  --cluster servicelink-prod \
  --service servicelink-api \
  --task-definition servicelink-api:PREVIOUS_REVISION

# Vercel
vercel rollback <deployment-url>
```

---

## Security Checklist

Before going live:

- [ ] All secrets rotated from development values
- [ ] `CORS_ORIGIN` set to production domain only
- [ ] JWT_SECRET is 32+ bytes, cryptographically random
- [ ] Database has SSL/TLS enforced
- [ ] Redis requires authentication
- [ ] Stripe webhook secret matches production
- [ ] CSP enabled (`ENABLE_STRICT_CSP=true`)
- [ ] Rate limiting configured appropriately
- [ ] Sentry error tracking enabled
- [ ] Database backups automated (daily minimum)
- [ ] SSL certificates valid and auto-renewing
- [ ] Security headers configured (see SECURITY-AUDIT.md)

---

## Performance Checklist

- [ ] Database indexes created (see Database Setup)
- [ ] Redis caching enabled for categories, provider search
- [ ] CDN configured for static assets
- [ ] Image optimization enabled (Next.js)
- [ ] API response gzip compression enabled
- [ ] Database connection pooling configured (max 100)
- [ ] Auto-scaling rules configured (CPU > 70%)
- [ ] Health checks passing with <500ms response time

---

## Related Documentation

- [RUNBOOK.md](./RUNBOOK.md) - Operations and incident response
- [ROLLBACK.md](./ROLLBACK.md) - Rollback procedures
- [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) - Security review and hardening
- [LOAD-TESTING.md](./LOAD-TESTING.md) - Performance testing guide
- [PLAYBOOK.md](./PLAYBOOK.md) - Development playbook

---

**Next Steps After Deployment**:
1. Run load tests (see LOAD-TESTING.md)
2. Monitor metrics for 24 hours
3. Conduct user acceptance testing
4. Plan phased rollout (10% → 50% → 100% traffic)
5. Document any production-specific configurations
