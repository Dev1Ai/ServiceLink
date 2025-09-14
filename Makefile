# Simple developer convenience targets

SHELL := /bin/sh

.PHONY: install dev api web seed e2e export stack-up stack-down db-up db-down

install:
	@corepack enable || true
	pnpm i

dev:
	PNPM_HOME=$$PNPM_HOME pnpm dev

api:
	PNPM_HOME=$$PNPM_HOME pnpm --filter api build && NODE_ENV=development node apps/api/dist/main.js

web:
	PNPM_HOME=$$PNPM_HOME ENABLE_STRICT_CSP=true pnpm --filter web build && pnpm --filter web start

seed:
	PNPM_HOME=$$PNPM_HOME pnpm db:generate && pnpm db:push && pnpm db:seed

e2e:
	PNPM_HOME=$$PNPM_HOME pnpm --filter web exec playwright install --with-deps || true
	ENABLE_STRICT_CSP=true E2E_API_BASE=http://localhost:3001 pnpm --filter web test:e2e

export:
	PNPM_HOME=$$PNPM_HOME pnpm --filter web run build:export

# Docker Compose helpers
stack-up:
	docker compose -f infra/docker-compose.yml up -d postgres redis api web

stack-down:
	docker compose -f infra/docker-compose.yml down

db-up:
	docker compose -f infra/docker-compose.yml up -d postgres redis

db-down:
	docker compose -f infra/docker-compose.yml rm -sfv postgres redis || true

