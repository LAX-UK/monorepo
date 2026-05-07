# Domain events retention

## Current state

The `domain_events` table is append-only. There is **no automated retention or archival** job today. Indexes exist for typical access patterns (`event_type`, aggregate id + type, `occurred_at`, acting legal entity + time).

## Compliance context

UK Companies Act / HMRC practice expects **financial records to be kept for at least six years**; we plan for **seven years** for payment- and payout-related evidence (events whose `event_type` is under the `payment.*` and `payout.*` families, plus closely linked lifecycle events). Non-financial events (`lot.*`, `bid.*`, auth-adjacent events, etc.) may be archived sooner when a policy is adopted, but there is **no operational pressure** to delete them in v1.

## When to act (triggers)

| Signal | Suggested response |
|--------|---------------------|
| **Row count > 10M** | Model growth rate; plan **declarative partitioning** of `domain_events` by `occurred_at` (e.g. monthly ranges) or move cold partitions to cheaper storage. |
| **`/admin/audit/domain-events/export` (or equivalent) p95 > 5s** | Review query shape, add **partial indexes** for hot filters, or restrict export windows before partitioning. |
| **Postgres disk usage > 70% of provisioned capacity** | Prioritise **archival** of cold time ranges (e.g. export to S3 object lock / Glacier) and detach or drop old partitions only after legal sign-off. |

## Future implementation notes

- **PostgreSQL declarative partitioning** on `occurred_at` (month or quarter) is the natural fit for time-ordered audit data.
- **Archival to S3** (immutable, versioned bucket) is the next step after partitioning for long-term cost and durability; keep enough metadata in Postgres to prove chain-of-custody if rows are moved off-primary.

**Explicitly out of scope for SE-P21:** building partitions or archival pipelines — this runbook records **when** to invest, not the implementation.
