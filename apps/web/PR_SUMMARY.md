# PR Summary — Export + CSP Hardening

## Overview

This change removes Next.js export SSR issues and hardens the web app for a strict, nonce‑free Content Security Policy (CSP). All pages now avoid inline styles/scripts and rely on CSS classes. Static export works across routes, and runtime CSP is configurable via middleware.

## Key Changes

- Removed server APIs that forced dynamic rendering (e.g., `next/headers`) from layout to enable static export.
- Eliminated all inline `<style>`/`next/script>` and React `style={...}` usage across the app.
- Added global CSS utilities in `app/globals.css` for layout, grid, spacing, badges, chips, tables, chat bubbles, tooltips, etc.
- Converted TooltipInfo to class‑based styling with `.tt-*` utilities (no inline positioning/styling).
- Introduced `CspWatcher` to surface CSP violations via toast during dev.
- Split build scripts:
  - `pnpm -C apps/web build`: server build (no export)
  - `pnpm -C apps/web build:export`: static export (`NEXT_OUTPUT=export next build`)
- CSP middleware (`apps/web/middleware.ts`):
  - Generates request nonce and sets headers when `ENABLE_STRICT_CSP=true`.
  - Uses `CSP_STRICT_LEVEL=balanced|strict` (default `balanced`).
  - Removed `style-src-attr` allowance; inline style attributes are disallowed.
- Added ESLint rule to prevent regressions:
  - `react/forbid-dom-props: ["error", { "forbid": ["style"] }]` in `apps/web/.eslintrc.json`.

## Export & CSP Behavior

- Static export: `pnpm -C apps/web build:export`, then serve `apps/web/out/`.
- Middleware doesn’t run on static hosts; set CSP at CDN/host. Suggested header:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-ancestors 'self'; base-uri 'self'; object-src 'none'
```

- Dev/server strict CSP: `ENABLE_STRICT_CSP=true pnpm -C apps/web dev` (or build/start). No inline styles/scripts used anywhere.

## Files of Interest

- `app/layout.tsx` — export‑safe layout; imports `globals.css`, mounts `ToastProvider` and `CspWatcher`.
- `app/globals.css` — utility classes and components styling.
- `app/components/CspWatcher.tsx` — dev helper for CSP violation events.
- `app/components/TooltipInfo.tsx` — class‑based tooltip implementation.
- `middleware.ts` — CSP header configuration.
- `.eslintrc.json` — lint rule blocking JSX `style` prop.

## Validation

- ESLint: `pnpm -C apps/web lint` — clean.
- Search: no `style={` occurrences under `apps/web`.
- Export: `pnpm -C apps/web build:export` — generates static output.

## Follow‑ups (Optional)

- Visual polish for utility class spacing as needed.
- Add a CI job to run `pnpm --filter web lint` and possibly a grep check for `style={`.
- Consider adding Playwright smoke tests to assert no `securitypolicyviolation` events on key routes.
