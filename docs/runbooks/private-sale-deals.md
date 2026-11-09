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
| `PRIVATE_SALE_PAYMENT_DUE_DAYS` | The invoice (sets the payment deadline) |
| `PRIVATE_SALE_COLLECTION_DUE_DAYS` | Nothing; the collection date is left unset |
| `PRIVATE_SALE_BUYER_FEE_BPS` | Nothing; there is no buyer's fee by default |

Approved defaults live in code: source of funds from £9,000 (`SOF_THRESHOLD_AMOUNT`), AML threshold
£10,000, parties anonymous to each other.

## Who can do what

| Capability | Can |
| --- | --- |
| `PRIVATE_SALE_DEALS_READ_ACCESS` (private sale managers, private sale enquiry readers, finance, fulfilment, compliance) | Open the list and the record |
| `private_sale.manage` | Name the buyer, set the price, costs and disclosure, open the offer, record the agreement, re-check clearance, cancel |
| `finance.platform.write` | Set the buyer's fee, the commission and the VAT treatment, issue the invoice, refund the buyer |
| `operations.fulfilment` | Release the work |

Issuing the invoice and refunding need a recent sign-in and an idempotency key. The person who
recorded the agreement cannot issue the invoice for the same deal.

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

## KYC evidence of the parties

The KYC retention purge (`KYC_RETENTION_PURGE_ENABLED`) deletes a closed account's identity checks, screenings and source-of-funds files five years after the relationship ends. A deal's record is kept for `PRIVATE_SALE_RECORD_RETENTION_YEARS` after the deal ends, which can be longer, and the evidence of the checks on its parties is part of that record. So the purge keeps the evidence of anyone who is, or was ever named as, a party to a deal (read from the deal's parties and its party history, so a buyer replaced before agreement counts) for as long as any of those deals' records is retained, by the same rule that holds the deal's enquiry from erasure:

- while the deal is open;
- after it settles, or is cancelled after agreement, until the retention has run from its end;
- after a deal cancelled before agreement, only if a check was opened for them since the enquiry arrived;
- always, if a deal's end is not recorded.

The evidence is deleted only when both clocks have run out: their own five years and every deal's retention. The same holds for an organisation or personal account that is a party. The purge's log and summary count the subjects kept for this reason (`heldForDeals`), including in a dry run, and the purge reads the worker's `PRIVATE_SALE_RECORD_RETENTION_YEARS` (never under 5). Someone who was never on a deal is purged exactly as before.

### Holds that need a person

Most holds end by themselves when the deal's retention runs out. Two do not, so the summary counts them separately and compliance is emailed (the compliance recipients, or the admin address if there are none; at most once a week for the same deals, whether or not the purge is switched on):

- **`heldWithoutEnd`:** a deal that has ended but has no end date recorded. A settled deal is dated by the stage history's settle row, and by the deal's last update if there is none, so this should be rare; when it happens the evidence is kept indefinitely until the deal's end is recorded.
- **`heldByStaleDeal`:** an open deal that has not changed stage for longer than the retention period. Finish it, cancel it or explain it; until then its parties' evidence stays.

The email names the deals (references only, never a person's details). Enable the purge in production only when these two counts are understood.

### Who counts as a party

Anyone ever named on a deal counts, whether a person or an organisation. The party history keeps an organisation named before anyone acted for it (no person on the row), so its documents are held like anyone else's. A check counts as this deal's own clearance when evidence was created for the person between the enquiry arriving and the deal ending; evidence from before the enquiry, or from long after the deal ended, is not taken for the deal. There is no link from a screening or a source-of-funds case to a particular deal, so this window is the closest the data allows.

### On a data request

A request's record page shows a "Kept for a private sale" section when the person is on a deal: each deal's reference and when the hold ends (or that it runs until the deal ends, or that its end is not recorded and compliance has been asked to look). It reads the same rule as the erasure and the purge, so what staff tell the person is what will happen.

## Rolling back

`0323_rollback.sql` returns `private_sale_deal.artwork_register_id` to text and keeps its values.
Roll back the application release first.
