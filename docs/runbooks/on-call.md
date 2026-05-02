# On-call

The procedure for receiving and responding to alerts. Read it before your first shift.

> **Status note.** The alert routing described below is **(operational, not in repo)** — alert rules and PagerDuty (or equivalent) are configured in the DigitalOcean and Sentry consoles. The list of which alerts page on-call vs. just chat-ping is the source of truth for "what should wake me up", and it lives in 1Password under "On-call alert mapping".

## What pages on-call

These alerts page (phone call + push) regardless of business hours:

- Any `apps/api` or `apps/auth` instance returning 5xx for more than 60 seconds sustained at >5% of traffic.
- Postgres connection pool exhaustion (the cluster is rejecting connections).
- Redis unavailability for more than 60 seconds.
- A Sentry error matching the "auth-anomaly" rule (sustained spike in successful auth without sign-in events — possible JWT forgery).
- The pre-deploy migration job failing on a production deploy.
- `apps/worker` `/health/ready` flapping for more than 10 minutes (more than three transitions ready ↔ not-ready).

These alerts ping the on-call channel during business hours and queue for the morning otherwise:

- A projector cursor falling more than 15 minutes behind the latest event id.
- BullMQ job dead-letter queue depth >100.
- Cloudflare WAF triggering more than usual on `/api/auth/*`.
- Disk usage on the Postgres cluster crossing 80%.
- Sentry release-health regression after a deploy.

Anything not in the list is a chat-ping that resolves itself or escalates manually if needed.

## When you're paged

1. **Acknowledge within 5 minutes.** Open the on-call channel and say "I have it."
2. **Get context.** Look at the alert in Sentry or DigitalOcean. Read the dashboard. Check the most recent deploys (`gh pr list --base release --state merged --limit 5`).
3. **Decide: contain or roll back.** If the alert is correlated with a deploy in the last hour, **roll back first**, debug after. The rollback button in DigitalOcean is faster than your debugging is.
4. **Communicate.** Update the on-call channel within 15 minutes of acknowledgement, every 30 minutes thereafter. The principle: more updates than feels necessary.

## When to wake someone up

These are the only conditions under which you wake another engineer:

- The incident is actively losing user data and you don't know why.
- The incident requires a Postgres `auction_owner` action you don't have credentials for.
- The incident has been ongoing for more than two hours and you're stuck.
- A second incident fires while you're already mid-incident.

For anything else: contain it, document what you did, escalate in the morning.

## Specific incident types

Each of the following has a dedicated runbook. Read the runbook, follow it; don't improvise.

- [JWT key leak](./jwt-key-leak.md)
- [Zoho outage](./incident-zoho-outage.md)
- [Deletion request (GDPR Article 17)](./deletion-request.md)
- [JWKS rotation (proactive or emergency)](./jwks-rotation.md)

If your incident doesn't match any of these, write the runbook for it after you contain it. Future-you will thank you.

## After the incident

Within 48 hours:

1. Post-incident write-up in the on-call channel: timeline, root cause, fix, what went well, what didn't.
2. If a runbook should have existed, write it. If a runbook existed but didn't cover the specific case, update it.
3. If a Sentry rule or alert threshold was wrong (too late, too noisy), adjust it.
4. If the on-call discovered a class of risk we hadn't documented, add it to [../architecture/07-security-model.md](../architecture/07-security-model.md).

## Handover

The on-call rotation is one week, Monday 9 a.m. UK time. At handover, the outgoing on-call posts a summary of: open incidents, alerts that fired but didn't page, and any context the incoming on-call needs.
