# ServiceLink Environment Setup Guide

**Version**: 1.0
**Last Updated**: 2025-10-03
**Audience**: Developers setting up local development environment

## Table of Contents
1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [IDE Configuration](#ide-configuration)

---

## Quick Start

**TL;DR** - Get running in 5 minutes:

```bash
# 1. Clone and install
git clone https://github.com/your-org/servicelink.git
cd servicelink
pnpm install

# 2. Start services (Docker)
docker compose up -d postgres redis

# 3. Setup database
cp .env.example .env
pnpm --filter api prisma db push
pnpm --filter api prisma db seed

# 4. Run dev servers
pnpm dev
```

**Access**:
- API: http://localhost:3001
- Web: http://localhost:3000
- Swagger: http://localhost:3001/docs

---

## Prerequisites

### Required Software

| Tool | Version | Installation |
|------|---------|-------------|
| **Node.js** | 18+ LTS | https://nodejs.org |
| **pnpm** | 9+ | `npm install -g pnpm` |
| **Docker** | 24+ | https://docker.com |
| **Git** | 2.40+ | https://git-scm.com |
| **PostgreSQL** | 15+ | Via Docker (recommended) |
| **Redis** | 7+ | Via Docker (recommended) |

### Optional Tools

- **pgAdmin** / **DBeaver**: Database GUI
- **Redis Insight**: Redis GUI
- **Postman** / **Insomnia**: API testing
- **VS Code**: Recommended IDE with extensions (see IDE Configuration)

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/servicelink.git
cd servicelink
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install project dependencies (monorepo)
pnpm install

# Verify installation
pnpm --version  # Should be 9.x
node --version  # Should be 18.x+
```

### 3. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
# Minimum required for local dev:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
```

**`.env` for Local Development**:

```bash
# ---- Core ----
NODE_ENV=development
PORT=3001

# ---- Database / Cache ----
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/servicelink
REDIS_URL=redis://localhost:6379

# ---- Auth ----
JWT_SECRET=local-development-secret-change-in-production

# ---- Optional: Stripe (use test keys) ----
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# ---- Optional: OpenAI (for AI features) ----
OPENAI_API_KEY=sk-proj-...
WHISPER_MODE=api

# ---- Optional: Notifications ----
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_NUMBER=+1555...

# ---- Development Settings ----
REMINDER_WORKER_ENABLED=false  # Disable background jobs in dev
SEARCH_RATE_DISABLE=true       # Disable rate limiting in dev
```

---

## Database Setup

### Option 1: Docker Compose (Recommended)

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Verify services are running
docker compose ps

# View logs
docker compose logs -f postgres
docker compose logs -f redis
```

**`docker-compose.yml`** (if not already present):

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: servicelink
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Option 2: Local Installation

**macOS** (Homebrew):
```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install postgresql-15 postgresql-contrib redis-server
sudo systemctl start postgresql
sudo systemctl start redis
```

**Windows**:
- PostgreSQL: Download installer from https://www.postgresql.org/download/windows/
- Redis: Use WSL2 or Docker

### 3. Initialize Database

```bash
# Push Prisma schema to database
pnpm --filter api prisma db push

# Generate Prisma client
pnpm --filter api prisma generate

# Seed database with sample data
pnpm --filter api prisma db seed
```

**Verify Database**:

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/servicelink

# List tables
\dt

# Check sample data
SELECT * FROM "User" LIMIT 5;
SELECT * FROM "Category" LIMIT 5;

# Exit
\q
```

---

## Running the Application

### Development Mode

#### Run All Services (Turborepo)

```bash
# Start API + Web concurrently
pnpm dev

# API will be at: http://localhost:3001
# Web will be at: http://localhost:3000
```

#### Run Individual Services

```bash
# API only
pnpm --filter api dev

# Web only
pnpm --filter web dev

# Mobile (Expo)
pnpm --filter mobile-uber-polished start
```

### Production Build (Local Testing)

```bash
# Build all packages
pnpm build

# Run production build
pnpm start
```

### Background Worker (Optional)

```bash
# Start BullMQ reminder worker
pnpm --filter api start:worker

# Or enable in .env
REMINDER_WORKER_ENABLED=true
```

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run API tests only
pnpm --filter api test

# Run with coverage
pnpm --filter api test:cov

# Watch mode
pnpm --filter api test:watch
```

### E2E Tests

```bash
# Run Playwright E2E tests
pnpm --filter web test:e2e

# Run with UI
pnpm --filter web test:e2e:ui

# Run specific test file
pnpm --filter web playwright test tests/auth-flow.spec.ts
```

**Prerequisites for E2E**:
- API server running on port 3001
- Web server running on port 3100
- Database seeded with test data

### API Testing (Manual)

```bash
# Using curl
curl http://localhost:3001/health

# Using Swagger UI
open http://localhost:3001/docs

# Create test user
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User","role":"customer"}'
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3001`

**Fix**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3002
```

#### 2. Database Connection Failed

**Symptom**: `Error: P1001: Can't reach database server`

**Fix**:
```bash
# Check if PostgreSQL is running
docker compose ps postgres
# OR
brew services list | grep postgresql

# Restart PostgreSQL
docker compose restart postgres
# OR
brew services restart postgresql@15

# Verify connection
psql $DATABASE_URL -c "SELECT 1"
```

#### 3. Prisma Client Not Generated

**Symptom**: `Cannot find module '@prisma/client'`

**Fix**:
```bash
# Generate Prisma client
pnpm --filter api prisma generate

# If still fails, clean and reinstall
rm -rf node_modules
pnpm install
pnpm --filter api prisma generate
```

#### 4. pnpm Install Fails

**Symptom**: `ERR_PNPM_LOCKFILE_BREAKING_CHANGE`

**Fix**:
```bash
# Update pnpm
npm install -g pnpm@latest

# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 5. TypeScript Errors in IDE

**Symptom**: Red squiggly lines everywhere

**Fix**:
```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Or rebuild
pnpm build
```

#### 6. Redis Connection Issues

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Fix**:
```bash
# Start Redis
docker compose up -d redis

# Verify
redis-cli ping
# Should return: PONG
```

---

## IDE Configuration

### VS Code (Recommended)

**Required Extensions**:
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Prisma (`Prisma.prisma`)
- TypeScript (`ms-vscode.vscode-typescript-next`)

**Recommended Extensions**:
- Thunder Client (API testing)
- Docker (container management)
- GitLens (Git visualization)
- Error Lens (inline errors)

**`.vscode/settings.json`**:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  }
}
```

**`.vscode/launch.json`** (Debugging):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "api", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "api", "test", "--", "--runInBand"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Run database migrations (if any)
pnpm --filter api prisma migrate dev

# 4. Start dev servers
pnpm dev

# 5. Make changes, test, commit
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature
```

### Code Quality

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm type-check
```

### Database Management

```bash
# Create new migration
pnpm --filter api prisma migrate dev --name add_new_field

# Reset database (⚠️ deletes all data)
pnpm --filter api prisma migrate reset

# View database in Prisma Studio
pnpm --filter api prisma studio
# Opens at: http://localhost:5555
```

---

## Performance Tips

### Faster Installs

```bash
# Use pnpm's frozen lockfile
pnpm install --frozen-lockfile

# Skip optional dependencies
pnpm install --no-optional
```

### Faster Builds

```bash
# Use Turborepo cache
pnpm build

# Clear cache if needed
rm -rf .turbo node_modules/.cache
```

### Database Query Optimization

```typescript
// Enable query logging
// apps/api/src/prisma/prisma.service.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Check slow queries in logs
```

---

## Next Steps

After environment setup:

1. **Read the PLAYBOOK.md** - Development guidelines and conventions
2. **Explore Swagger API** - http://localhost:3001/docs
3. **Run E2E tests** - Verify everything works
4. **Check RUNBOOK.md** - Operational procedures
5. **Review SECURITY-AUDIT.md** - Security best practices

---

## Getting Help

- **Slack**: #servicelink-dev
- **GitHub Issues**: https://github.com/your-org/servicelink/issues
- **Documentation**: https://docs.servicelink.com
- **Team Lead**: [Name] - [email]

---

## Appendix: Common Commands

```bash
# ---- Installation ----
pnpm install                    # Install dependencies
pnpm install <package>          # Add package to root
pnpm --filter api add <pkg>     # Add package to API
pnpm --filter web add <pkg>     # Add package to Web

# ---- Development ----
pnpm dev                        # Start all dev servers
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm test                       # Run all tests

# ---- Database ----
pnpm --filter api prisma studio              # Open Prisma Studio
pnpm --filter api prisma db push             # Push schema to DB
pnpm --filter api prisma migrate dev         # Create migration
pnpm --filter api prisma db seed             # Seed database

# ---- Docker ----
docker compose up -d            # Start all services
docker compose down             # Stop all services
docker compose logs -f          # View logs
docker compose ps               # List running services

# ---- Debugging ----
pnpm --filter api dev --inspect # Start API with debugger
pnpm --filter web dev --debug   # Start Web with debugger
```
