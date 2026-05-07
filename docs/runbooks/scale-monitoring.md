# Scale monitoring (Round 3 follow-through)

Observability targets derived from the Round 3 scale audit. These are **investigation thresholds**, not SLO guarantees. Tune per environment once baselines exist.

## Hot paths

### Per-lot bid throughput

- **Alert:** more than **100 bids/minute** on a **single** `lot_id` (sustained 2+ minutes).
- **Why:** `SELECT FOR UPDATE` on the lot row serialises writers; extreme rates indicate lock contention or abuse.
- **Check:** Postgres `pg_locks`, slow query log on `bid` insert, Redis idempotency key cardinality.

### Redis command latency

- **Alert:** **p99 > 50ms** for application commands (excluding blocking commands).
- **Why:** Bid idempotency, BullMQ, notifications, and settlement locks share the instance; latency spikes propagate to user-visible paths.

### Webhook handler latency (API)

- **Alert:** any Stripe (or other) webhook route **p95 > 2s**.
- **Why:** Providers expect fast `2xx`; slow handlers increase retries and duplicate delivery pressure even when idempotency keys exist.

### Bulk payout settlement (`POST /internal/jobs/bulk-payout-settlement`)

- **Alert:** end-to-end handler duration **> 5 minutes** (excluding deliberate dry runs).
- **Why:** Long runs overlap poorly with weekly windows; a **409** from the distributed lock means a second caller — log and confirm the first run is healthy.

### Email queue depth (worker)

- **Alert:** **> 1000** pending jobs in the `email` queue (or outbox rows stuck > 30 minutes without drain).
- **Why:** Backlog delays transactional mail; check Postmark status, worker concurrency, and downstream rate limits.

### PDF payout statements (worker)

- **Alert:** any single `generate-payout-statement` job **> 30s** wall time or repeated **OOM** kills.
- **Why:** Large line-item sets are CPU/memory heavy; concurrency is intentionally low (`concurrency: 2`).

## Related runbooks

- `docs/runbooks/domain-events-retention.md` — when `domain_events` growth drives query or disk risk.
