# Release Notes — Web Export + CSP Hardening + E2E

## Highlights

- Fixed Next.js export SSR issues by removing dynamic server APIs from layout.
- Refactored all pages to avoid inline styles/scripts; added utility CSS.
- Hardened CSP (strict, nonce‑free) with middleware control and Playwright validation.
- Added static‑friendly quote page (`/jobs/quote?id=...`).
- CI now spins up Postgres + Redis + API, seeds DB, and runs E2E.

## Developer Impact

- New lint rule forbids JSX `style={...}` in apps/web.
- Manual static export workflow available (`Static Export (web)` GitHub Action).
- Playwright E2E suite covers CSP, auth, realtime, quotes, verify completion, providers search/near, and categories.

## How to Build/Run

- Server build: `pnpm -C apps/web build && pnpm -C apps/web start`
- Static export: `pnpm -C apps/web build:export` then serve `apps/web/out/` (dynamic `[id]` routes skipped).
- Strict CSP: set `ENABLE_STRICT_CSP=true` (prod allows only https/ws(s)).

## Notes

- Dynamic routes in export builds require `generateStaticParams` or query‑param alternatives.
- Dev CSP allows `http:` connect‑src, prod does not.
