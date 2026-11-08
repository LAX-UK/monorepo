# Payout settlement periods

Each settlement covers a period. Staff runs and the settlement cron work it out the same way, inside
the settlement itself, after the seller's settlement lock is taken and through the same database
transaction:

- It ends at the moment the run is made.
- It starts where the seller's latest payout period ended. For a seller's first payout it starts
  at the oldest waiting payment, and never before 2000-01-01.
- Staff may ask for a later start. A start before the latest period's end, in the future, or before
  2000-01-01 is refused (`settlement_period_overlaps`, `settlement_period_in_future`,
  `settlement_period_open_ended`) and nothing is written.

Because the period is read under the lock, two runs for one seller (a staff run and the cron, or
two staff runs) cannot be given overlapping periods: the second waits, then sees the first
payout's end and continues from it.

## A reversed payout and payments that come back

A reversed payout keeps its period. If staff relink payments from a reversed payout so they are
paid again, those payments were captured before the latest period's end. The next payout starts at
that end, so its statement period does not contain their capture dates.

This is expected. The payout's lines, not its period dates, say which payments it pays. When a
seller asks why a payment sits outside the statement period, check the payout lines for the payment
and the reversed payout it came from.

## Monitoring

The worker counts money-path events on its metrics endpoint as
`auction_worker_money_path_events_total{event=...}`, using the same event names as
`auction_api_money_path_events_total` (see `monitoring-alerts.md`). Alert on the sum of both
counters for the payout events, since the cron now runs in the worker.
