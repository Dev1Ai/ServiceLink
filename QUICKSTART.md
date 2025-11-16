# ServiceLink - Clean Workflow Quickstart

**Status**: ✅ Clean baseline established (M8.5)
**Date**: 2025-11-16

---

## 🚀 Immediate Actions Required (5 minutes)

### 1. Set Up Branch Protection (GitHub UI)

Go to: **Settings** → **Branches** → **Add rule**

#### For `main` branch:
```
Branch name pattern: main

✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale reviews when new commits pushed

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Add status checks: lint, test, build, e2e

✅ Require conversation resolution before merging

✅ Do not allow bypassing the above settings
```

#### For `develop` branch:
```
Branch name pattern: develop

✅ Require a pull request before merging
   ✅ Require approvals: 1

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date
   Add status checks: lint, test, build

✅ Require conversation resolution before merging
```

### 2. Reset Main Branch (After Step 1!)

⚠️ **ONLY do this AFTER branch protection is set up!**

```bash
# Verify you're on develop
git checkout develop
git pull origin develop

# Verify it's clean (should see 86 tests passing)
pnpm install
pnpm db:generate
pnpm --filter api test

# Reset main to clean state
git checkout main
git reset --hard develop
git push --force origin main
```

### 3. Verify Setup

```bash
# Check protected branches
gh api repos/:owner/:repo/branches/main/protection | jq '.required_status_checks'
gh api repos/:owner/:repo/branches/develop/protection | jq '.required_status_checks'

# Should show: ["lint", "test", "build"]
```

---

## 📊 Current Repository State

```
ServiceLink/
├── main (needs reset after protection)
├── develop ✅ CLEAN (M8.5 - 86 tests passing)
│   └── feature/jobs-pii-foundation ✅ (ready for PR)
│       ├── JobsService (3 tests passing)
│       ├── PiiService (regex fixed)
│       └── Workflow docs
├── baseline/m8.5-clean (reference)
└── backups/
    ├── backup/current-main-20251116-0947
    └── backup/feature-branch-20251116-0947
```

---

## 🎯 Next Development Steps

### Create Your First Clean PR

```bash
# Already on feature/jobs-pii-foundation branch
gh pr create \
  --base develop \
  --head feature/jobs-pii-foundation \
  --title "feat: add JobsService and PiiService foundation" \
  --body "## Description
Establishes core job creation service with PII redaction utilities.

## Type of Change
- [x] New feature

## Changes Made
- JobsService with unique key generation
- PiiService for email/phone redaction
- Development workflow documentation
- Branch protection setup guide
- PR template and workflow guide

## Testing
- [x] Unit tests added/updated (3/3 passing)
- [x] Manual testing performed
- [x] All tests passing locally

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
- [x] No breaking changes"
```

### After PR is Merged

```bash
# Update develop
git checkout develop
git pull origin develop

# Start next feature
git checkout -b feature/next-feature

# Make changes...
pnpm lint && pnpm --filter api test

# Commit and push
git add .
git commit -m "feat: add next feature"
git push -u origin feature/next-feature

# Create PR
gh pr create --base develop
```

---

## 📋 Daily Workflow (Reference)

Full workflow guide: [.github/WORKFLOW.md](.github/WORKFLOW.md)

**Quick version:**
```bash
# Morning: Start work
git checkout develop && git pull
git checkout -b feature/my-feature

# Development cycle
# ... make changes ...
pnpm lint && pnpm --filter api test
git add . && git commit -m "feat: description"

# Before PR
git rebase origin/develop
pnpm install && pnpm db:generate
pnpm lint && pnpm --filter api test

# Create PR
git push -u origin feature/my-feature
gh pr create --base develop

# After approval
gh pr merge --squash --delete-branch
```

---

## 🔍 Quality Checks (Run Before Every PR)

```bash
# Full quality check
pnpm install
pnpm db:generate
pnpm lint                      # 0 errors required
pnpm --filter api test         # All passing
pnpm --filter web build        # Successful
pnpm --filter web test:e2e     # All passing
```

---

## 📁 Key Files Created

- **[.github/WORKFLOW.md](.github/WORKFLOW.md)** - Complete workflow guide
- **[.github/pull_request_template.md](.github/pull_request_template.md)** - PR template
- **[.github/BRANCH_PROTECTION_SETUP.md](.github/BRANCH_PROTECTION_SETUP.md)** - GitHub settings
- **[RESET_SUMMARY.md](RESET_SUMMARY.md)** - Complete reset documentation
- **[QUICKSTART.md](QUICKSTART.md)** - This file

---

## 🚨 Remember

### DO:
✅ Always work in feature branches
✅ Run tests before committing
✅ Keep PRs focused and small
✅ Rebase frequently
✅ Get approval before merging

### DON'T:
❌ Commit directly to main/develop
❌ Force push to shared branches
❌ Merge without CI passing
❌ Skip the PR template
❌ Bypass reviews

---

## 🆘 If Something Goes Wrong

**Broke something on feature branch?**
```bash
git checkout feature/my-branch
git reset --hard origin/develop
# Start over
```

**Need original main back?**
```bash
git checkout main
git reset --hard backup/current-main-20251116-0947
git push --force origin main
```

**Need original JobsService work?**
```bash
git checkout backup/feature-branch-20251116-0947
```

---

## ✅ Success Checklist

After completing this quickstart:

- [ ] Branch protection set up on `main`
- [ ] Branch protection set up on `develop`
- [ ] Main branch reset to clean M8.5 state
- [ ] First PR created from `feature/jobs-pii-foundation`
- [ ] Team understands new workflow
- [ ] CI/CD verified on PRs

---

## 📞 Questions?

- Workflow: Check `.github/WORKFLOW.md`
- Setup issues: Check `RESET_SUMMARY.md`
- Recovery: Check backup tags above

---

**You're all set!** 🎉

Your repository now has:
- ✅ Clean baseline (M8.5)
- ✅ Clear branch strategy
- ✅ Enforced quality gates
- ✅ Complete documentation
- ✅ Recovery procedures

Time to start building! 🚀
