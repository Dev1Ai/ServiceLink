# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages 2>/dev/null || true
RUN pnpm i --frozen-lockfile

FROM deps AS build
RUN pnpm --filter api build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production \
    PORT=3001
# copy node_modules and built dist for api
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=deps /app/apps/api/package.json /app/apps/api/package.json
EXPOSE 3001
CMD ["node","apps/api/dist/main.js"]

