# Payout Transfer Blocked

Use this runbook when a payout is in status `transfer_blocked`. No money moves for a blocked
payout until staff resolve it. Resolving it needs the finance write capability, a recent
sign-in (step-up), and a written reason of at least 10 characters. Every resolution is recorded in
the audit log as `payout.transfer_block_resolved`.

## What blocked means

Before sending a seller's transfer, the platform asks Stripe what it already holds for the payout
(by transfer group `payout:<payoutId>`, and for payouts created before 2026-05-24 also by
`metadata.payoutId` on transfers to the seller's account). Stripe forgets idempotency keys after
24 hours, so a retry cannot rely on its key to avoid paying twice.

The payout is blocked, and no transfer is created, when the answer is not exactly "no live
transfer" or "one clean matching transfer". The reason is on the payout
(`transfer_blocked: <reason> (<transfer ids>)`):

| Reason | Meaning |
| --- | --- |
| `multiple_live_transfers` | Two or more live transfers: one may be a duplicate. |
| `amount_mismatch` | The one live transfer is for a different amount. |
| `destination_mismatch` | It went to a different Stripe account. |
| `currency_mismatch` | It is in a different currency. |
| `partially_reversed` | Part of it was reversed, so the net position is unclear. |
| `payout_metadata_mismatch` | A transfer in the group names a different payout. |
| `transfer_listing_incomplete` | Stripe has too many transfers to scan, so none can be ruled out. |

The seller is not paid again by a blocked payout, and a retry does not apply to it.

## Lines added around a transfer attempt

Refund, give-back and dispute lines (and staff adjustments) go only on a `scheduled` payout, never
on one whose transfer has started. The transfer step holds the payout row (`FOR UPDATE`) from
reading the net until the payout has left `scheduled`, so a line either lands first and is sent
with the transfer, or goes on the seller's next payout.

An attempt can end with its outcome unknown: the connection to Stripe failed or Stripe answered
with a server error, so Stripe may already hold a transfer for the net that was read. The payout
stays `scheduled` with a failure reason starting `stripe_transfer_outcome_unknown:`, and takes no
new lines until a later attempt finds out (it adopts the transfer Stripe holds, or creates one when
there is none). New lines meanwhile go on a new payout. A failure reason starting
`stripe_transfer_failed:` means Stripe refused the request: no transfer exists, and the payout keeps
taking lines. The next attempt sends the new net under a new idempotency key, which names the amount.

An `amount_mismatch` on a payout from before this rule (2026-11) is most likely lines added after
an attempt whose outcome was unknown: compare the Stripe transfer with the net before those lines.

### How long a line waits for a transfer

The row lock is held across the Stripe calls of the transfer step: the check of what Stripe holds
(for payouts created before 2026-06-01, also a scan of up to 100 list pages) and the create. Each call is
tried up to 3 times with 2 s and 4 s back-off, and each request can take up to Stripe's 80 s
client timeout. Normally the hold is well under a few seconds. While Stripe is failing it can reach
several minutes. The bulk run sends one payout at a time, so at most one seller's payout is held.

A line for that seller's payout (a refund, give-back, dispute line or staff adjustment) waits for
the hold while it holds the payment's row, so a second refund of the same payment also waits.
There is deliberately no `lock_timeout` on the line side: a timeout would abort the refund or
dispute transaction and turn a wait into a failure that relies on a retry (the refund reconcile
queue, Stripe re-sending the webhook, or staff repeating a dispute allocation). Deadlocks are still
detected by Postgres within `deadlock_timeout`. Every line takes the payment before the payout, so
the line side and the transfer side do not form a cycle.

If refunds or dispute webhooks for one seller hang during a Stripe incident, look for sessions
waiting on a lock (`pg_stat_activity` with `wait_event_type = 'Lock'`) behind a transfer, and
pause the payout run (`DISABLE_PAYOUT_SETTLEMENT=true`) until Stripe recovers.

## Checks in Stripe

Use the seller's connected account and the transfer ids named on the payout.

1. Find every transfer for the payout: Transfers, filter by transfer group `payout:<payoutId>`.
2. Also find transfers to the seller's account (`acct_...`) created on or after the payout's
   creation date with `metadata.payoutId` equal to the payout id.
3. For each, note: destination account, currency, amount, whether it is reversed or partly
   reversed, and its creation time.
4. Check the payout's net amount in Bid admin (the transfer amount is in pence).
5. Check the transfer id is not already on another payout (search payouts by transfer id).

## Adopt or release

**Adopt a transfer** when exactly one live transfer is the seller's payment for this payout:
same account, same currency, same amount as the net, not reversed, and not on another payout.
Any extra live transfers must already have been dealt with in Stripe (for example reversed).
Enter its `tr_...` id. The server fetches it from Stripe and refuses unless every check passes. The
payout then moves to `in_transit` with that transfer, and the normal Stripe events complete it.

**Release for retry** only when Stripe holds no live transfer for this payout: none found by group,
none by metadata, or every one found is fully reversed. Tick the confirmation that you have checked
in Stripe. The payout moves to `failed` and can be retried after 5 minutes. The retry looks at Stripe
again and is blocked again if it finds a live transfer, but do not rely on that: a missed live
transfer risks paying the seller twice.

If unsure, do neither. When a transfer is a partial reversal, a duplicate, or to the wrong account,
sort out the money in Stripe first (reverse the duplicate or wrong transfer), then adopt the
correct one or release.

## After

- Adopted: confirm the payout reaches `paid` once Stripe reports the transfer.
- Released: retry from the payout, and confirm it reaches `in_transit`.
- Record the payout id, transfer ids and what you found in the incident tracker.
- Blocked payouts also show in the payouts attention strip ("N payouts blocked, need review") and
  as a critical row on the finance dashboard.
- A seller with a blocked or failed payout cannot delete their account until it is resolved.
