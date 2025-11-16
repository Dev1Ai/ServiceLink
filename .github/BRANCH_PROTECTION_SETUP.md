# Branch Protection Setup Guide

## Required GitHub Settings

### For `main` Branch

**Navigate to**: `Settings` → `Branches` → `Add rule` → Branch name pattern: `main`

#### Protection Rules:

**Require a pull request before merging**
- ✅ Require approvals: `1`
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (optional, if you have CODEOWNERS file)

**Require status checks to pass before merging**
- ✅ Require branches to be up to date before merging
- Required status checks (add these):
  - `lint`
  - `test`
  - `build`
  - `e2e` (if applicable)

**Require conversation resolution before merging**
- ✅ Enabled

**Do not allow bypassing the above settings**
- ✅ Enabled (recommended)
- Exception: Allow administrators to bypass (for emergencies only)

**Restrict who can push to matching branches**
- Optionally restrict to specific users/teams

---

### For `develop` Branch

**Navigate to**: `Settings` → `Branches` → `Add rule` → Branch name pattern: `develop`

#### Protection Rules:

**Require a pull request before merging**
- ✅ Require approvals: `1`
- ✅ Dismiss stale pull request approvals when new commits are pushed

**Require status checks to pass before merging**
- ✅ Require branches to be up to date before merging
- Required status checks:
  - `lint`
  - `test`
  - `build`

**Require conversation resolution before merging**
- ✅ Enabled

---

## CLI Alternative (using `gh` CLI)

```bash
# Protect main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -f required_status_checks='{"strict":true,"contexts":["lint","test","build","e2e"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismissal_restrictions":{},"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  -f restrictions=null

# Protect develop branch
gh api repos/:owner/:repo/branches/develop/protection \
  --method PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -f required_status_checks='{"strict":true,"contexts":["lint","test","build"]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews='{"dismissal_restrictions":{},"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  -f restrictions=null
```

---

## Verification

After setting up, verify:

```bash
# Check main protection
gh api repos/:owner/:repo/branches/main/protection | jq .

# Check develop protection
gh api repos/:owner/:repo/branches/develop/protection | jq .
```

---

## Current Workflow Summary

```
feature/xyz → PR → develop (requires: 1 approval + CI passing)
                    ↓
                    PR → main (requires: 1 approval + CI passing + up-to-date)
```

---

## Notes

- These settings prevent accidental direct pushes to protected branches
- All changes MUST go through PR process
- CI MUST pass before merge
- Conversations MUST be resolved
- Branches MUST be up-to-date with base branch

---

**Setup Date**: 2025-11-16
**Last Verified**: 2025-11-16
