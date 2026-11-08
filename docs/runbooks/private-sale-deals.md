# Private sale deals

A private sale is one work, one seller, one buyer and one agreed price, sold through LAX Bid
(London Auction Xchange LTD). Staff work deals at `/admin/private-sales`; a buyer sees theirs under
Purchases and a seller under Consignments, and either opens `/private-sales/PS-0012`.

## Starting a deal

A private sale enquiry becomes a deal from its record: **Convert to deal** (needs
`private_sale.manage`, and the enquiry must be in progress or waiting on the client).

- A sell enquiry opens a draft consignment for the work and a proposed deal with the sender as seller.
- A buy enquiry asks for the consignment reference of the work (`C-1042`); the work's owner is the
  seller and the sender is the buyer.
- The sender needs a LAX account. A guest is refused with "account required": invite them to create
  one, then convert.

## Terms not configured

No real deal can be agreed or invoiced until the business values are set. The deal record shows a
"Terms not configured" notice naming what is missing, and each step that needs one stays blocked
with its reason. Nothing is ever guessed.

| Variable | What it blocks while unset |
| --- | --- |
| `PRIVATE_SALE_TERMS_VERSION` | Agreement (both sides accept this version in the product) |
| `PRIVATE_SALE_COMMISSION_BPS` | The invoice (a commission is copied onto each new deal) |
| `PRIVATE_SALE_VAT_TREATMENTS` | The invoice (finance chooses a treatment from this list) |
| `PRIVATE_SALE_PAYMENT_DUE_DAYS` | Nothing; 7 days is suggested until the owner decides (sets the payment deadline at the invoice) |
| `PRIVATE_SALE_COLLECTION_DUE_DAYS` | Nothing; 14 days is suggested until the owner decides (sets the collection deadline when the deal is paid) |
| `PRIVATE_SALE_BUYER_FEE_BPS` | Nothing; there is no buyer's fee by default |

Approved defaults live in code: source of funds from £9,000 (`SOF_THRESHOLD_AMOUNT`), AML threshold
£10,000, parties anonymous to each other.

## Who can do what

| Capability | Can |
| --- | --- |
| `PRIVATE_SALE_DEALS_READ_ACCESS` (private sale managers, private sale enquiry readers, finance, fulfilment, compliance) | Open the list and the record |
| `private_sale.manage` | Name the buyer, set the price, costs and disclosure, open the offer, record the agreement, re-check clearance, cancel |
| `finance.platform.write` | Set the buyer's fee, the commission and the VAT treatment, issue the invoice, record a bank transfer, refund the buyer (all or part), record a refund made at the bank |
| `operations.fulfilment` | Release the work |

Issuing the invoice, recording a bank transfer, refunding and recording a bank refund need a recent sign-in and an idempotency key. The person who
recorded the agreement cannot issue the invoice for the same deal.

## Releasing the work

**Release the work** (fulfilment, once the deal is paid) asks how the work was handed over: who collected it, or the carrier and tracking reference. The note is required and is kept with the move in the deal's history, with who made it and when. Only then can the seller's payout be queued.

## Recording a bank transfer

A buyer normally pays at the checkout, and a bank transfer made there lands by itself. When money arrives another way, finance uses **Record a bank transfer** on an invoiced deal and gives the amount received and the bank's reference.

- The amount must be exactly what the buyer owes (the price plus any buyer's fee). A different amount is refused and nothing is recorded; a short or split payment is dealt with outside the deal.
- It is recorded as the deal's paid payment on the bank transfer rail, with who recorded it and the reference, and the deal moves to Paid in the same step.
- **The buyer's open checkout is ended first, and read back from Stripe.** Only a checkout Stripe shows as expired is replaced. If the buyer had already finished it (a card taken, or a bank transfer chosen) the record is refused with "the buyer has finished their checkout": money may still arrive, so wait for it or ask the buyer. If Stripe cannot confirm the checkout ended, it is refused too and can be tried again in a moment.
- A checkout the buyer has only just started, whose session is not recorded yet, is not replaced: record the transfer again after two minutes. One left unstarted longer than that is let go.
- If the buyer's own bank transfer through the checkout is on its way, recording is refused: wait for it to land, which is recorded automatically.
- Two finance users recording at once: one is recorded, the other is told the deal has been paid. Nothing of the second is kept.
- The buyer gets the same payment receipt as a card payment, once per payment.

### Money that arrives and cannot be applied

Money that reaches a deal's payment and cannot be applied is never dropped or quietly skipped. Finance gets a task and an alert (the same inbox and email as unapplied money on a lot invoice, naming the deal) to return it or apply it. This covers money arriving after the checkout was ended or after finance recorded a transfer (so the deal could be paid twice), and a payment of a different amount from the checkout. Nothing is refunded automatically. The task is closed by refunding the charge in Stripe or by a note from finance.

## Refunds

**Refund the buyer** returns the whole of what is left, or the amount given. Each part refund is a refund of its own at the payment provider and is added to the amount returned so far, shown on the payment. The payment stays Paid until all of the money has gone back, and only then can a paid deal be cancelled. A refund made directly in the Stripe dashboard is recorded the same way from the provider's report. Refunds made here are refused once the seller's payout includes the deal.

A part refund does not change the seller's payout, which stays on the agreed price. **When money goes back to the buyer after the payout included the deal** (for example a refund made in the Stripe dashboard), finance gets a task and an alert naming the deal: "the seller's payout may need adjusting". One is raised for every refund report that adds to what has been returned, so each part refund is seen. Finance adjusts the payout by hand.

### A refund made at the bank

A payment finance recorded as a bank transfer has no Stripe charge, so **Refund the buyer** is not offered for it. Finance returns the money from the bank and then uses **Record a bank refund** with the amount returned and the bank's reference. Nothing is sent from here: it records what finance did, so it needs the same care as recording the transfer.

- The amount is checked against what is left to return while the payment is locked, so two people recording at once cannot return more than was paid.
- Each record is kept as an audit event with who made it, the amount, the running total and the bank's reference.
- The payment becomes Refunded once all of it is recorded, and then the deal can be cancelled.
- Like a refund, it is refused once the seller's payout includes the deal. The payout is looked at again while the payment is locked; if it is queued in the moment the record is made, the record stands (the money has gone back) and finance gets the "seller's payout may need adjusting" alert.

## Reminders

Buyers are reminded of a deal's two deadlines, on the same schedule as an unpaid lot invoice (two days before, on the day at 09:00 London time, and three days after), by the same hourly job. **Each step is sent at most once.** Which steps have gone out is kept per deal, deadline and step, and is never cleared. If a deadline is moved later after a step was sent, that step is not sent again; steps not yet sent are sent against the new date. A job that was down sends only the latest step reached, not a backlog.

- Payment: while the deal is invoiced and unpaid. Not sent to a buyer LAX itself is holding for compliance, or to a closed account; a buyer who cannot pay yet is told what to do instead.
- Collection: while the deal is paid and not yet released.

The deadlines come from the settings above, which the owner's answer replaces. A deal keeps the deadline it was given when it was invoiced or paid, so changing a setting affects new deals only.

The collection reminder uses the "ready to collect" notice type, worded for a work and never for a lot ("Collect your work soon", "Your work is waiting to be collected"). The payment reminder reuses the lot invoice reminder, which still labels the work "Lot" in its email: that label is a known follow-up.

## Who sees which deal

- Administrators, sales managers (`auction.manage`), client services, finance and compliance see every deal.
- A specialist (`private_sale.manage` without those) sees and acts only on deals they own: the person who converted the enquiry.
- Fulfilment sees only paid deals waiting to be handed over.
- Identity, screening and source-of-funds rows are shown only to those who run the deal or decide the checks. Finance and fulfilment are told a deal is "waiting on the compliance checks" and nothing more.

## What is locked once the price is agreed

The price, buyer's fee, commission, costs and disclosure cannot change after agreement, because both sides accepted them. Only the VAT treatment stays open until the invoice. To change anything else, cancel the deal and start again. Agreement needs a commission on the deal, and the invoice needs the commission rate and terms version configured in policy.

## One live deal per work

A work can be in only one deal; only a cancelled deal frees it, so a settled (sold) work cannot be sold again. A partial unique index backs this, and creating an auction lot from a consignment that is in a private sale is refused. A buy enquiry can only name an approved consignment that has not become a lot, and whose owner is a client with an active place in the owning account.

## Checks

The record reads identity, screening and source of funds from the existing Compliance records and
never changes them. Agreement needs both parties' identity and screening clear; the invoice also
needs the buyer's source of funds approved when the price with their other open purchases reaches
the threshold. A deal clears when agreement is recorded and the checks are already green; otherwise
use **Check clearance** once Compliance has decided.

## Erasure and the converted enquiry

A converted private sale enquiry is part of its deal's record (the sender's contact, the work described, its provenance). Money Laundering Regulations 2017, regulation 40, requires that record to be kept for five years from the transaction, so the enquiry is held from erasure:

- while any deal made from it is open;
- after a deal settles, until `PRIVATE_SALE_RECORD_RETENTION_YEARS` (default 5, never below 5: the Bid API and the worker refuse a lower value) have passed since settlement;
- after a deal is cancelled, for the same period from the cancellation, if it ever reached agreement or a check was opened for anyone named on the deal at any time since the enquiry arrived;
- always, if it is marked converted but has no deal.

A check is a watchlist screening, a source-of-funds case, an anti-money-laundering hold on the account (in place, or since cleared), or an identity verification that was declined (the account's identity status is rejected, or Veriff's decision code is 9102). An expired or abandoned session is not a check. Every AML screening counts, including ones that came back clear, which holds more enquiries than strictly needed; that is the safe direction. The `aml.screening_evaluated` events repeat what the screening rows already show, and no hold can be set by hand without a screening, so a cleared hold is always covered. A check counts from the date of the enquiry, not the deal, because staff vet the person before converting. It counts for everyone ever named on the deal: each naming is kept in `private_sale_deal_party_history`, written in the same transaction as the party and refused any update or delete by a trigger, so a buyer replaced before agreement still counts. The table has no link to the account, so deleting an account does not remove who was named, and no account-erasure rule touches it (a test guards this).

Screenings and source-of-funds files are themselves purged five years after an account closes (KYC retention). A deal record is held for the same five years from the deal's end, so the two periods overlap but do not match; if the longer private sale period is set above 5, review the KYC purge before relying on the evidence of a check.

A deal cancelled before anyone agreed a price, with no such check for anyone named on it, is not a transaction: its enquiry is erased like any other. Once the period has passed, a later erasure request or retention run erases the enquiry. The setting applies to the Bid API and the worker; the owner's answer on deal record retention replaces the default.

## Rolling back

`0323_rollback.sql` returns `private_sale_deal.artwork_register_id` to text and keeps its values.
Roll back the application release first.
