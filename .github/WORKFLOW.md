# Development Workflow

## Branch Strategy

```
main (protected, production-ready)
  ↑
develop (integration, weekly releases)
  ↑
feature/xyz (short-lived, 1-3 days)
```

### Branch Rules

- **main**: ALWAYS production-ready, ALL CI passing, requires 1 approval
- **develop**: Integration branch, merges to main weekly
- **feature/**: Small focused changes, merge to develop
- **fix/**: Bug fixes
- **hotfix/**: Critical production fixes (only branch from main)

## Daily Workflow

### 1. Start New Work

```bash
# Update develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/short-descriptive-name

# Example: feature/add-job-validation
```

### 2. Development

```bash
# Make changes...

# Check quality before committing
pnpm lint
pnpm --filter api test

# Commit
git add .
git commit -m "feat(api): add job validation logic"
```

### 3. Pre-PR Checklist

**MANDATORY before creating PR:**

```bash
✅ pnpm install                    # Sync dependencies
✅ pnpm db:generate                # Update Prisma client
✅ pnpm lint                       # Must pass (warnings OK)
✅ pnpm --filter api test          # All tests pass
✅ pnpm --filter web test:e2e      # E2E tests pass
✅ git rebase origin/develop       # Up to date
```

### 4. Create Pull Request

```bash
# Push to origin
git push -u origin feature/short-descriptive-name

# Create PR to develop (NOT main)
gh pr create \
  --base develop \
  --title "feat: add job validation" \
  --body "Adds validation for job creation endpoints

## Changes
- Add Zod schema for job DTOs
- Implement validation middleware
- Add unit tests

## Testing
- ✅ All tests passing
- ✅ Lint clean
- ✅ E2E verified"
```

### 5. After Approval

```bash
# Squash merge (keeps history clean)
gh pr merge --squash --delete-branch
```

## PR Requirements

### Title Format
Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(api): add new endpoint`
- `fix(web): resolve login issue`
- `chore(ci): update workflow`
- `docs: update README`

### Required Checks (CI)
- ✅ Lint (0 errors, <50 warnings)
- ✅ Type Check
- ✅ Unit Tests (>60% coverage)
- ✅ E2E Tests
- ✅ Build Success

### Required Reviews
- 1 approval minimum
- All conversations resolved

## Common Tasks

### Fix Merge Conflicts

```bash
git fetch origin develop
git rebase origin/develop

# Resolve conflicts
# ... edit files ...

git add .
git rebase --continue
git push --force-with-lease
```

### Update from Develop

```bash
git checkout feature/my-branch
git fetch origin develop
git rebase origin/develop
pnpm install && pnpm db:generate
```

### Run Full Quality Check

```bash
# From repo root
pnpm install
pnpm db:generate
pnpm lint
pnpm --filter api test
pnpm --filter web build
pnpm --filter web test:e2e
```

## Release Process

### Weekly Release (develop → main)

```bash
# 1. Verify develop is clean
git checkout develop
git pull origin develop
pnpm install && pnpm db:generate
pnpm lint && pnpm --filter api test

# 2. Create release PR
gh pr create \
  --base main \
  --head develop \
  --title "chore: weekly release $(date +%Y-%m-%d)" \
  --body "Weekly integration of completed features"

# 3. After CI passes + approval
gh pr merge --merge --no-delete-branch

# 4. Tag release
git checkout main
git pull origin main
git tag -a v1.x.x -m "Release v1.x.x"
git push origin v1.x.x
```

## Emergency Hotfix

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. Fix + test
# ... make changes ...
pnpm lint && pnpm --filter api test

# 3. PR to main
gh pr create --base main --title "hotfix: ..."

# 4. After merge, sync back to develop
git checkout develop
git merge main
git push origin develop
```

## Troubleshooting

### "Tests failing locally but pass in CI"
```bash
# Clean state
rm -rf node_modules pnpm-lock.yaml
rm -rf apps/*/node_modules
pnpm install
pnpm db:generate
pnpm --filter api test
```

### "Merge conflicts in pnpm-lock.yaml"
```bash
# Regenerate lockfile
git checkout origin/develop -- pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git rebase --continue
```

### "PR blocked by failing check"
```bash
# View CI logs
gh pr checks

# Re-run failed jobs
gh pr checks --watch
```

## Best Practices

✅ **DO:**
- Keep PRs small (<400 lines)
- Write descriptive commit messages
- Add tests for new features
- Update docs when changing APIs
- Rebase frequently to avoid conflicts
- Run quality checks before pushing

❌ **DON'T:**
- Commit directly to main/develop
- Force push to shared branches
- Merge without PR approval
- Skip tests
- Leave TODO comments without issues
- Commit `.env` files
- Use `any` types without ESLint disable

## Git Hygiene

### Clean Up Old Branches

```bash
# List merged branches
git branch --merged develop | grep -v "^\*\|main\|develop"

# Delete locally
git branch -d feature/old-branch

# Delete remote
git push origin --delete feature/old-branch
```

### Squash Messy History

```bash
# Before PR, squash commits
git rebase -i origin/develop

# Mark commits as 'squash' or 'fixup'
```

## Getting Help

- Questions? Ask in team chat before breaking things
- Workflow issues? Check this doc first
- CI/CD problems? Check `.github/workflows/`
- Need review? Tag someone in PR

---

**Last Updated**: 2025-11-16
**Maintained By**: Development Team
