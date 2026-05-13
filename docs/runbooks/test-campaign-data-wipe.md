# Runbook: Test campaign — data wipe / reset

For non-production environments used for demos or test campaigns, prefer **destroying the environment** (separate DB/Redis/Spaces) over mutating production.

## When to use

- End of a marketing test campaign on a **dedicated** test stack.
- Need to remove PII-heavy rows before sharing access with a new cohort.

## Preconditions

- Confirm **database URL** points at the test instance (never run destructive steps against prod from this doc).
- Take a **snapshot or logical dump** if legal/compliance requires retention of the test period.

## Options

### A. Full environment reset (preferred)

- Tear down the test stack (Terraform / DO app / k8s namespace) and reprovision empty Postgres + migrations + optional seed.
- Rotates all secrets implicitly if new env.

### B. Selective SQL wipe (advanced)

Only if ops maintains a curated script:

1. Stop workers and API writers to the test DB.
2. Truncate or delete in **dependency order** (sessions, bids, payments, lots, legal entities, users, domain events, outbox).
3. Re-run `pnpm db:migrate` if schema drifted.
4. Run `pnpm db:seed` if a baseline demo dataset is required.

**Do not** paste ad-hoc `DELETE FROM user` snippets into production tooling.

## Post-wipe

- [ ] Invalidate CDN caches if marketing pages embeded user-specific content.
- [ ] Re-point Postmark/Stripe **test** webhooks at the new URL if the hostname changed.
- [ ] Document completion in the campaign ticket.
