# Settlement day ops (Monday 09:00 UTC)

Bulk seller settlement runs on a **single owner** per environment. Confirm flags before reading logs:

| Mode | Config fingerprint | Execution path |
|------|-------------------|----------------|
| **API rollback (default)** | `FINANCE_CRON_EXECUTION_OWNER=api_rollback`, `FINANCE_CRON_API_ROLLBACK=true` | Worker BullMQ job → `POST /internal/jobs/bulk-payout-settlement` on API (`apps/worker/src/jobs/bulk-payout-settlement.ts`, `apps/api/src/routes/internal-cron.ts`) |
| **Worker-local** | `FINANCE_CRON_EXECUTION_OWNER=worker`, `FINANCE_CRON_API_ROLLBACK=false`, matching on API + worker | Worker runs `runWorkerBulkPayoutSettlement` in-process; API finance routes return **409** |

Shared Redis lock: `payout:settlement:lock` (API and worker use the same key). Lock contention should log `bulk_payout_settlement_skipped_locked` or `bulk_payout_settlement_deferred` — not a silent success.

## Pre-flight (Friday before)

- [ ] Stripe Connect accounts for active sellers show **payouts enabled** (refresh via Connect status endpoint — live-synced from Stripe when configured).
- [ ] Migrations **0072**+ applied (unique sale line per payment; required before settlement scale-up).
- [ ] No payout rows stuck in `failed` without owner.
- [ ] Redis and API healthy; `CRON_INTERNAL_SECRET` set identically on API + worker when using API rollback.
- [ ] CI smoke: `pnpm --filter @auction/background-runtime build && node scripts/ci/run-runtime-ownership-smoke-gates.mjs` green (`settlement.bulk_payout` → parity suite).

## Ledger model (settlement)

- Sale lines at settlement use the **gross** captured payment amount.
- Pre-settlement refunds/disputes appear as negative **adjustment** lines on the open payout (or clawback payout); they are not netted again into the sale line amount.
- Multiple partial refunds on the same payout aggregate into one refund line per payment.

## Monday 09:05 UTC

1. Check worker logs for `bulk_payout_settlement_entity` / completion (worker-local) or API internal cron success (rollback mode).
2. Spot-check **3 random payouts** in admin: status `paid` or correctly `scheduled`/`in_transit`.
3. Verify Stripe **Transfers** list for the batch window.
4. If any `scheduled` payout remains without transfer **>24h** after the window, page finance + engineering (see [worker-runtime-cutover.md](./worker-runtime-cutover.md)).

## Common failure modes

| Failure | Action |
|---------|--------|
| 401 on internal cron | Rotate `CRON_INTERNAL_SECRET` consistently or fix typo (rollback mode). |
| Redis lock contention | Look for `deferred` / `settlement_already_running` logs; retry next hour; do not force-delete lock without ops review. |
| Transfer blocked (Connect) | Seller onboarding incomplete — notify account manager. |
| Worker owner but 409 from API | Misconfigured owner flags — worker should not call API for finance crons when `FINANCE_CRON_EXECUTION_OWNER=worker`. |

## Escalation

- Finance + engineering lead if any **paid** payout lacks Stripe transfer after 2h.

## Related

- [Worker runtime cutover](./worker-runtime-cutover.md)
- [Redis queue replay](./redis-queue-replay.md)
- [Stripe incident](./stripe-incident.md)
