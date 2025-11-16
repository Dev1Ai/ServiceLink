# On-Call Guide

This guide outlines the responsibilities and procedures for the on-call engineer.

## On-Call Responsibilities

- **Primary Responder:** You are the first point of contact for all production alerts.
- **Triage:** Acknowledge, investigate, and classify incoming alerts (P1, P2, P3).
- **Communication:** Keep stakeholders informed about ongoing incidents and their status.
- **Resolution:** Drive incidents to resolution, either by applying a known fix, rolling back, or escalating to the appropriate subject matter expert.
- **Handoff:** At the end of your shift, provide a summary of any ongoing issues to the next on-call engineer.

## Alerting Channels

- **Primary:** PagerDuty (or similar alerting tool).
- **Secondary:** Slack channel `#alerts`.
- **Monitoring:** Sentry for errors, Grafana for metrics, Neon for database health.

## Common Alert Types

- **High Error Rate (Sentry):** See the [Runbook](RUNBOOK.md#high-error-rate-in-sentry) for the SOP.
- **API Latency Spike (Grafana):** Investigate the API service logs and metrics. Check for bad deployments, upstream service issues, or database contention.
- **Database CPU High (Neon/Grafana):** See the [Runbook](RUNBOOK.md#database-performance-issues) for the SOP.

## Escalation Policy

- If you are unable to resolve a P1 incident within 30 minutes, escalate to the secondary on-call engineer.
- If the issue involves a specific subsystem (e.g., payments), escalate to the subject matter expert for that area.
