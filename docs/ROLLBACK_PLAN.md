# Rollback Plan

This document describes the procedures for rolling back a failed deployment.

## When to Rollback

A rollback should be considered when a deployment results in a critical incident, such as:

- A significant increase in the error rate (P1 alert).
- A major feature is broken for a large number of users.
- A security vulnerability is introduced.
- The application is unstable or unavailable.

The on-call engineer is empowered to make the decision to roll back. When in doubt, err on the side of caution and roll back.

## Rollback Procedures

### API (Render)

1.  Go to the service's "Deploys" tab in the Render dashboard.
2.  Find the last known good deployment.
3.  Click the "Rollback to this deploy" button.
4.  Monitor the service logs and metrics to ensure the rollback is successful.

### Web (Vercel)

1.  Go to the project's "Deployments" tab in the Vercel dashboard.
2.  Find the last known good deployment (it will be labeled "Current").
3.  Find the new, problematic deployment and use the context menu to select "Redeploy". This is a misnomer; you should find the previous deployment and promote it to production.
4.  Find the previous deployment, click the context menu, and select "Promote to Production".

### Database (Prisma)

Database rollbacks are high-risk and should be avoided if possible. A rollback of the application code should be the first step.

If a database migration is the cause of the issue and it cannot be fixed with a forward migration, a manual rollback may be necessary.

1.  **Take a backup:** Before attempting any manual changes, create a backup of the database.
2.  **Identify the migration:** Find the migration to be reverted in the `prisma/migrations` directory.
3.  **Apply the down migration:** This is not directly supported by Prisma. You will need to manually write and apply the SQL statements to reverse the migration.
4.  **Update the `_prisma_migrations` table:** Manually remove the record of the rolled-back migration.

**NOTE:** This is a last resort. A hotfix migration is almost always preferable.
