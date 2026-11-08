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

A check is a watchlist screening, a source-of-funds case, an anti-money-laundering hold on the account, or an identity verification that was declined. It counts from the date of the enquiry, not the deal, because staff vet the person before converting. It counts for everyone ever named on the deal, including a buyer who was replaced before agreement (each naming is recorded in the deal's `private_sale_deal.party_named` event with the person's account id). A hold that has since been cleared leaves no date, so only a hold still in place counts.

A deal cancelled before anyone agreed a price, with no such check for anyone named on it, is not a transaction: its enquiry is erased like any other. Once the period has passed, a later erasure request or retention run erases the enquiry. The setting applies to the Bid API and the worker; the owner's answer on deal record retention replaces the default.

## Rolling back

`0323_rollback.sql` returns `private_sale_deal.artwork_register_id` to text and keeps its values.
Roll back the application release first.
