# Load Testing Guide - ServiceLink

**Date**: 2025-10-03
**Milestone**: M8 - Production Hardening

## Overview

This document outlines load testing strategies for ServiceLink to ensure production readiness and identify performance bottlenecks.

## Tools

### Recommended Stack
1. **k6** - Modern load testing tool with JavaScript scripting
2. **Artillery** - Alternative for quick HTTP/WebSocket tests
3. **Grafana + InfluxDB** - Metrics visualization
4. **PostgreSQL pg_stat_statements** - Query performance tracking

## Quick Start with k6

### Installation
```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Basic Load Test Script

Create `load-tests/auth-flow.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],              // Error rate under 10%
  },
};

export default function () {
  // Sign up
  const signupRes = http.post(`${BASE_URL}/auth/signup`, JSON.stringify({
    email: `user-${__VU}-${Date.now()}@example.com`,
    password: 'TestPass123!',
    name: `Test User ${__VU}`,
    role: 'customer',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(signupRes, {
    'signup successful': (r) => r.status === 201,
  }) || errorRate.add(1);

  sleep(1);

  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: `user-${__VU}-${Date.now()}@example.com`,
    password: 'TestPass123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200 || r.status === 201,
  });

  if (!loginSuccess) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('access_token');

  // Create job
  const jobRes = http.post(`${BASE_URL}/jobs`, JSON.stringify({
    title: `Load test job ${Date.now()}`,
    description: 'Testing load on job creation',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  check(jobRes, {
    'job created': (r) => r.status === 201,
  }) || errorRate.add(1);

  sleep(2);
}
```

### Run Load Test

```bash
# Basic run
k6 run load-tests/auth-flow.js

# Run with custom API URL
API_BASE_URL=https://staging.api.servicelink.com k6 run load-tests/auth-flow.js

# Output results to InfluxDB for Grafana visualization
k6 run --out influxdb=http://localhost:8086/k6 load-tests/auth-flow.js
```

## Test Scenarios

### 1. Authentication Flow (auth-flow.js)
**Target**: 100 concurrent users
**Duration**: 5 minutes
**Endpoints**: `/auth/signup`, `/auth/login`
**Expected p95**: < 300ms

### 2. Job Creation Flow (jobs-flow.js)
**Target**: 50 concurrent users (customers + providers)
**Duration**: 10 minutes
**Endpoints**: `/jobs`, `/jobs/:id/quotes`, `/jobs/:id/quotes/:id/accept`
**Expected p95**: < 500ms

### 3. Provider Search (search-flow.js)
**Target**: 200 concurrent users
**Duration**: 5 minutes
**Endpoints**: `/providers/search`, `/providers/near`
**Expected p95**: < 400ms

### 4. WebSocket Chat (realtime-flow.js)
**Target**: 100 concurrent connections
**Duration**: 10 minutes
**Events**: `join`, `chat`, `typing`
**Expected connection success**: > 95%

### 5. Payment Flow (payments-flow.js)
**Target**: 20 concurrent users
**Duration**: 5 minutes
**Endpoints**: `/stripe/create-payment-intent`, `/stripe/webhook`
**Expected p95**: < 800ms

## Database Performance Monitoring

### Enable pg_stat_statements

```sql
-- In PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
  calls,
  total_exec_time / 1000 AS total_time_seconds,
  mean_exec_time / 1000 AS mean_time_ms,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries taking > 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Reset stats between test runs
SELECT pg_stat_statements_reset();
```

### Check for N+1 Queries

```typescript
// Add logging to Prisma queries
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'warn', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  if (process.env.LOG_QUERIES === 'true') {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  }
});
```

## API Metrics Collection

### Add Response Time Histogram

```typescript
// apps/api/src/metrics/metrics.service.ts
export class MetricsService {
  private httpDurationHistogram: Histogram;

  constructor() {
    this.httpDurationHistogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 10ms to 5s
    });
  }

  recordHttpDuration(method: string, route: string, status: number, duration: number) {
    this.httpDurationHistogram.observe({ method, route, status }, duration);
  }
}
```

## Performance Benchmarks

### Baseline Performance (Local Development)

| Endpoint | Method | p50 | p95 | p99 | RPS |
|----------|--------|-----|-----|-----|-----|
| `/auth/login` | POST | 80ms | 150ms | 250ms | 100 |
| `/auth/signup` | POST | 120ms | 200ms | 350ms | 50 |
| `/jobs` | POST | 60ms | 120ms | 200ms | 80 |
| `/jobs/:id/quotes` | POST | 70ms | 140ms | 220ms | 60 |
| `/providers/search` | GET | 50ms | 90ms | 150ms | 200 |
| `/providers/near` | GET | 45ms | 85ms | 140ms | 200 |

### Production Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| API p95 latency | < 500ms | < 1s |
| WebSocket connection success | > 98% | > 95% |
| Error rate | < 1% | < 5% |
| Database connection pool usage | < 70% | < 90% |
| Redis hit rate | > 80% | > 60% |
| Memory usage | < 1GB | < 2GB |
| CPU usage | < 60% | < 80% |

## Bottleneck Identification

### Common Performance Issues

1. **N+1 Queries** (jobs.service.ts:125, quotes.service.ts:87)
   ```typescript
   // ❌ Bad: N+1 query
   const jobs = await this.prisma.job.findMany();
   for (const job of jobs) {
     job.assignment = await this.prisma.assignment.findUnique({
       where: { jobId: job.id }
     });
   }

   // ✅ Good: Single query with include
   const jobs = await this.prisma.job.findMany({
     include: {
       assignment: {
         include: { provider: { include: { user: true } } }
       }
     }
   });
   ```

2. **Missing Indexes**
   - Add composite index on (jobId, providerId, status) for quotes
   - Add index on location columns for geo queries

3. **Large Payload Responses**
   - Implement pagination for `/jobs/mine`
   - Use cursor-based pagination for infinite scroll

4. **Expensive Calculations in Hot Paths**
   - Cache category list (rarely changes)
   - Pre-calculate provider ratings

## Load Testing Schedule

### Pre-Production
- **Week -2**: Baseline performance tests (local)
- **Week -1**: Staging environment load tests (50% production load)
- **Week 0**: Production simulation (100% expected load + 20% buffer)

### Post-Production
- **Monthly**: Peak load simulation (2x normal traffic)
- **Quarterly**: Stress testing (10x normal traffic until failure)
- **Before major releases**: Regression testing

## Monitoring Setup

### Grafana Dashboard Panels

1. **HTTP Request Rate** (requests/sec by endpoint)
2. **Response Time Distribution** (p50, p95, p99)
3. **Error Rate** (4xx, 5xx by endpoint)
4. **Database Query Performance** (slow queries, connection pool)
5. **WebSocket Connections** (active connections, messages/sec)
6. **System Resources** (CPU, memory, disk I/O)

### Alerts

```yaml
# Example Prometheus alert rules
groups:
  - name: servicelink_api
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        annotations:
          summary: "High error rate detected ({{ $value }})"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 5m
        annotations:
          summary: "p95 latency above 1s ({{ $value }}s)"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.9
        for: 1m
        annotations:
          summary: "Database connection pool at {{ $value }}%"
```

## Optimization Checklist

### Before Load Testing
- [ ] Enable query logging (`LOG_QUERIES=true`)
- [ ] Set up pg_stat_statements
- [ ] Configure Prometheus + Grafana
- [ ] Disable non-essential logging in staging
- [ ] Warm up caches (Redis)
- [ ] Set realistic rate limits

### During Load Testing
- [ ] Monitor CPU/memory/disk usage
- [ ] Watch database connection pool
- [ ] Track Redis memory usage
- [ ] Monitor WebSocket connection count
- [ ] Check for memory leaks

### After Load Testing
- [ ] Analyze slow query log
- [ ] Review error logs for patterns
- [ ] Check for N+1 queries
- [ ] Identify missing indexes
- [ ] Document performance issues

## Next Steps

1. **Create k6 test scripts** for all 5 scenarios above
2. **Set up InfluxDB + Grafana** for metrics visualization
3. **Configure pg_stat_statements** on staging database
4. **Run baseline tests** on local/staging environment
5. **Document performance bottlenecks** and optimization plan
6. **Implement caching** for expensive queries (categories, ratings)
7. **Add database indexes** based on slow query analysis
8. **Set up continuous load testing** in CI/CD pipeline

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Prisma Performance Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Query Optimization](https://www.postgresql.org/docs/current/performance-tips.html)
- [NestJS Performance Tips](https://docs.nestjs.com/techniques/performance)
