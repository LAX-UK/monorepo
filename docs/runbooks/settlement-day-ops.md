# Settlement day ops (Monday 09:00 UTC)

Bulk seller settlement is driven by the worker heartbeat calling `POST /internal/jobs/bulk-payout-settlement` (`apps/worker/src/index.ts`, `apps/api/src/routes/internal-cron.ts`).

## Pre-flight (Friday before)

- [ ] Stripe Connect accounts for active sellers show **payouts enabled**.
- [ ] No payout rows stuck in `failed` without owner.
- [ ] Redis and API healthy; `CRON_INTERNAL_SECRET` set identically on API + worker.

## Monday 09:05 UTC

1. Check worker logs for `bulk-payout-settlement` completion message.
2. Spot-check **3 random payouts** in admin: status `paid` or correctly `scheduled`/`in_transit`.
3. Verify Stripe **Transfers** list for the batch window.

## Common failure modes

| Failure | Action |
|---------|--------|
| 401 on internal cron | Rotate `CRON_INTERNAL_SECRET` consistently or fix typo. |
| Redis lock contention | Second run next hour; do not force without reading lock key semantics. |
| Transfer blocked (Connect) | Seller onboarding incomplete — notify account manager. |

## Escalation

- Finance + engineering lead if any **paid** payout lacks Stripe transfer after 2h.

## Related

- [Redis queue replay](./redis-queue-replay.md)
- [Stripe incident](./stripe-incident.md)
