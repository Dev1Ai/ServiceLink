## Description
<!-- Brief description of what this PR does -->

## Type of Change
<!-- Mark with an 'x' -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] CI/CD changes

## Changes Made
<!-- List the key changes in this PR -->
-
-
-

## Testing
<!-- Describe how you tested these changes -->
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed
- [ ] All tests passing locally

## Checklist
<!-- ALL items must be checked before requesting review -->
- [ ] Code follows project style guidelines
- [ ] `pnpm lint` passes with 0 errors
- [ ] `pnpm --filter api test` all passing
- [ ] `pnpm --filter web test:e2e` passing (if web changes)
- [ ] No console errors or warnings
- [ ] Prisma schema updated (if DB changes)
- [ ] `pnpm db:generate` run successfully
- [ ] `.env.example` updated (if new env vars)
- [ ] Documentation updated (if API/behavior changes)
- [ ] Rebased on latest `develop`

## Database Changes
<!-- If schema changes, describe them -->
- [ ] No database changes
- [ ] Migration added: `migrations/YYYYMMDDHHMMSS_description`
- [ ] Seed data updated

## Breaking Changes
<!-- List any breaking changes and migration path -->
- [ ] No breaking changes
- [ ] Breaking changes described below:

## Screenshots/Videos
<!-- If UI changes, add screenshots or videos -->

## Related Issues
<!-- Link related issues -->
Closes #
Related to #

## Deployment Notes
<!-- Any special deployment considerations -->
- [ ] No special deployment steps
- [ ] Environment variables need updating
- [ ] Manual migration required
- [ ] Other (describe below):

---

## Reviewer Checklist
<!-- For reviewer use -->
- [ ] Code quality is acceptable
- [ ] Tests adequately cover changes
- [ ] No security vulnerabilities introduced
- [ ] Performance impact acceptable
- [ ] Documentation is clear
