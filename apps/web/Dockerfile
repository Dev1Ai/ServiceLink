# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages 2>/dev/null || true
RUN pnpm i --frozen-lockfile

FROM deps AS build
# Build only the web app (avoid export for prod server)
RUN pnpm --filter web exec next build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL:-/api}
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules /app/apps/web/node_modules
COPY --from=build /app/apps/web/.next /app/apps/web/.next
COPY apps/web/package.json apps/web/next.config.mjs apps/web/public/ ./apps/web/
EXPOSE 3000
CMD ["sh","-lc","node node_modules/next/dist/bin/next start -p 3000 apps/web"]
