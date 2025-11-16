## Summary

Briefly describe the purpose of this PR.

## Getting Started (local)

```bash
make compose-dev   # DB + API + Web
make seed          # prisma generate/push/seed
make e2e           # run Playwright strict-CSP tests (API on :3001)
```

Demo (end-to-end via API):

```bash
API_BASE=http://localhost:3001 scripts/demo.sh
```

## Changes

- [ ] Web:
- [ ] API:
- [ ] Tests:
- [ ] CI:

## Screenshots / Demos (optional)

## Checklist

- [ ] Lint passes (`pnpm --filter web lint` and `pnpm --filter api lint`)
- [ ] API tests pass (`pnpm --filter api exec jest -c jest.config.ts --passWithNoTests`)
- [ ] Web builds (`pnpm --filter web build`) and strict CSP works (`ENABLE_STRICT_CSP=true pnpm --filter web start`)
- [ ] Swagger docs updated if endpoints changed

## Notes

Add any gotchas or follow-ups.
