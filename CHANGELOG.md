# Changelog

## Unreleased

### Added

- CI workflow to lint web/api and run API tests (`.github/workflows/ci.yml`).
- Providers search/near query DTOs (`SearchProvidersQueryDto`, `NearProvidersQueryDto`).
- Providers response DTOs for search and near results.
- Unit tests: `ProvidersController` search and near logic.
- HTTP-style tests: providers search/near and jobs/quotes accept/revoke flows.
- Toast feedback for realtime, quote submit, and job create in the web app.

### Changed

- ProvidersController: refactored to typed DTOs, removed `any`, unified pagination shape.
- Realtime gateway/service: stronger typing for client data, throttling storage, and Redis.
- Guards: typed Express `Request` usage and storage access patterns.
- Metrics: added `recordHttpDuration` helper; typed middleware.
- Error filter: use `unknown` and minimal typed union for payloads.
- Payments webhook: typed `Request` with `rawBody` and narrowed event handling.
- Web pages: fixed React hook dependencies using `useCallback` and proper dep arrays.

### Fixed

- ESLint setup (pinned to v8 for Next 14). Both web and api lint without warnings.

### Notes

- Some Prisma `groupBy` calls require relaxed typing; small casts are used where necessary.
- Supertest HTTP tests require a local/CI environment (sandbox denies binding ports).
