# Runbook

This document provides standard operating procedures (SOPs) for common operational tasks and incident response.

## Common Tasks

### Deploying a new version

1.  **Merge to `main`:** Ensure the feature branch is up-to-date with `main` and all CI checks are passing.
2.  **Create a new release tag:** Use `git tag vX.Y.Z` and push the tag.
3.  **Monitor the release:** Observe the CI/CD pipeline in GitHub Actions and monitor Sentry for any new errors.

### Database Migrations

1.  **Create a migration:** `pnpm db:migrate-dev --name <migration-name>`
2.  **Apply migrations:** Migrations are applied automatically on deployment. For manual application, connect to the production database and run `pnpm db:deploy`.

### Scaling Services

- **API (Render):** Adjust the number of instances in the Render dashboard.
- **Web (Vercel):** Vercel handles scaling automatically.
- **Database (Neon):** Adjust the compute resources in the Neon dashboard.

## Incident Response

### High Error Rate in Sentry

1.  **Acknowledge the alert:** Notify the team in the on-call channel.
2.  **Identify the release:** Check the Sentry event details to see which release is affected.
3.  **Analyze the stack trace:** Determine the root cause of the error.
4.  **Rollback or Hotfix:**
    - If the cause is a recent deployment, initiate a rollback (see Rollback Plan).
    - If the cause is a minor issue, prepare and deploy a hotfix.
5.  **Post-mortem:** Document the incident, root cause, and resolution.

### Database Performance Issues

1.  **Check Neon dashboard:** Look for high CPU usage, long-running queries, or connection saturation.
2.  **Analyze slow queries:** Use the `pg_stat_statements` extension or Neon's query analysis tools.
3.  **Optimize or scale:** Add indexes, optimize queries, or scale up the database compute resources.
