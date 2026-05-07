# Dispute Clawback Manual Reconciliation

Use this runbook when a Stripe dispute is lost after the seller payout has
already been paid. Stripe cannot create a negative Connect transfer, so the
platform must recover funds manually.

## Trigger

`charge.dispute.closed` with a lost outcome creates a negative dispute payout
line. If there is no open seller payout, the system creates an adjustment-only
payout. The next payout settlement pass marks that payout `clawback_pending`
and emits `payout.clawback_required`.

## Triage

1. Open `/admin/payouts?status=clawback_pending`.
2. Confirm the payout net amount, seller legal entity, linked dispute event, and
   payment/lot context.
3. Record the case in the incident tracker with the payout id and Stripe dispute
   id.

## Recovery Options

Choose one option with finance/legal approval:

1. **Reverse the original Stripe transfer** if the connected account balance can
   cover the reversal.
2. **Next-period offset** if the seller has future sales. Add/retain the
   negative payout so future positive settlement is reduced before transfer.
3. **Direct repayment** if no Stripe reversal or future offset is available.
   Invoice the seller and reconcile manually in Xero.

## Close-Out

1. Add an admin note to the payout or linked incident describing the selected
   recovery path.
2. Once funds are recovered or written off, manually reverse or resolve the
   payout according to finance policy.
3. Notify the seller finance contact of the outcome and retain Stripe/Xero
   references for audit.
