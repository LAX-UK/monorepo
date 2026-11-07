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

## Checks

The record reads identity, screening and source of funds from the existing Compliance records and
never changes them. Agreement needs both parties' identity and screening clear; the invoice also
needs the buyer's source of funds approved when the price with their other open purchases reaches
the threshold. A deal clears when agreement is recorded and the checks are already green; otherwise
use **Check clearance** once Compliance has decided.

## Rolling back

`0322_rollback.sql` returns `private_sale_deal.artwork_register_id` to text and keeps its values.
Roll back the application release first.
