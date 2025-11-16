# Action Checklist - Clean Workflow Setup

**Status**: ✅ Reset complete, ready for final steps
**Date**: 2025-11-16

---

## ✅ COMPLETED

- [x] Created clean baseline from M8.5
- [x] Verified tests passing (86/86 on develop)
- [x] Created develop branch
- [x] Cherry-picked JobsService work
- [x] Created workflow documentation
- [x] Backed up original state
- [x] Pushed all branches to remote

---

## 🎯 TODO (15 minutes)

### Step 1: Set Up Branch Protection (5 min)

**Go to GitHub:**
https://github.com/Dev1Ai/ServiceLink/settings/branches

**Add rule for `main`:**
```
Branch name pattern: main

✅ Require pull request before merging
   - Require approvals: 1
   - Dismiss stale reviews: Yes

✅ Require status checks to pass
   - Require branches up to date: Yes
   - Status checks required: lint, test, build, e2e

✅ Require conversation resolution

✅ Do not allow bypassing
```

**Add rule for `develop`:**
```
Branch name pattern: develop

✅ Require pull request before merging
   - Require approvals: 1

✅ Require status checks to pass
   - Require branches up to date: Yes
   - Status checks required: lint, test, build

✅ Require conversation resolution
```

**Verify:**
```bash
gh api repos/Dev1Ai/ServiceLink/branches/main/protection
gh api repos/Dev1Ai/ServiceLink/branches/develop/protection
```

---

### Step 2: Reset Main Branch (2 min)

⚠️ **ONLY after Step 1 is complete!**

```bash
# Switch to develop
git checkout develop
git pull origin develop

# Verify it's clean
pnpm --filter api test | grep "Test Suites"
# Should show: Test Suites: 17 passed, 17 total

# Reset main
git checkout main
git reset --hard develop
git push --force origin main
```

**Verify:**
```bash
git log main --oneline -3
# Should match develop exactly
```

---

### Step 3: Create First PR (3 min)

```bash
# Switch to feature branch
git checkout feature/jobs-pii-foundation

# Create PR
gh pr create \
  --base develop \
  --head feature/jobs-pii-foundation \
  --title "feat: add JobsService and PiiService foundation" \
  --body "## Description
Establishes core job creation service with PII redaction utilities.

## Type of Change
- [x] New feature

## Changes Made
- JobsService with unique key generation (3 tests passing)
- PiiService for email/phone redaction
- Development workflow documentation
- Branch protection setup guide
- PR template and workflow guide

## Testing
- [x] Unit tests added/updated
- [x] All tests passing locally (3/3)
- [x] Manual testing performed

## Checklist
- [x] Code follows project style guidelines
- [x] \`pnpm lint\` passes with 0 errors
- [x] \`pnpm --filter api test\` all passing
- [x] No console errors or warnings
- [x] \`pnpm db:generate\` run successfully
- [x] Documentation updated
- [x] Rebased on latest \`develop\`

## Database Changes
- [x] No database changes

## Breaking Changes
- [x] No breaking changes

## Related Issues
Part of workflow reset and cleanup effort."
```

**Verify:**
```bash
gh pr list
# Should show your new PR
```

---

### Step 4: Cleanup (2 min - Optional)

**Delete old feature branches:**
```bash
# Local
git branch -D feature/add-jobs-pii-services
git branch -D feature/ai-assisted-refactor

# Remote (only after confirming work is saved!)
git push origin --delete feature/ai-assisted-refactor
```

**Keep these backups:**
- `backup/current-main-20251116-0947`
- `backup/feature-branch-20251116-0947`
- `baseline/m8.5-clean`

---

## ✅ SUCCESS CRITERIA

After completing all steps, verify:

- [ ] Branch protection enabled on `main`
- [ ] Branch protection enabled on `develop`
- [ ] `main` branch reset to M8.5
- [ ] First PR created and visible
- [ ] CI running on PR
- [ ] All tests passing

**Run verification:**
```bash
# Check protection
gh api repos/Dev1Ai/ServiceLink/branches/main/protection | jq '.required_status_checks'

# Check main matches develop
git log main --oneline -1
git log develop --oneline -1

# Check PR
gh pr list --state open
```

---

## 📋 NEXT DEVELOPMENT CYCLE

After your first PR is merged:

```bash
# Update develop
git checkout develop
git pull origin develop

# Start new feature
git checkout -b feature/next-feature

# Follow workflow
# See: .github/WORKFLOW.md
```

---

## 🆘 HELP

**Commands:**
- Workflow guide: `cat .github/WORKFLOW.md`
- Reset details: `cat RESET_SUMMARY.md`
- Quick start: `cat QUICKSTART.md`

**Recovery:**
- Backup tags: `git tag -l "backup/*"`
- Reset main: `git reset --hard backup/current-main-20251116-0947`

---

## 📊 CURRENT STATE

**Branches:**
- `main`: Needs reset (has TypeScript errors)
- `develop`: ✅ CLEAN (M8.5 - 86 tests passing)
- `feature/jobs-pii-foundation`: ✅ READY (3 tests passing)

**Tests on develop:**
```
Test Suites: 17 passed, 17 total
Tests:       86 passed, 86 total
```

**Tests on feature:**
```
JobsService: 3 passed, 3 total
```

---

**Last Updated**: 2025-11-16 09:50 EST
**Next Action**: Step 1 - Set up branch protection
