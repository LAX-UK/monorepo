# ATG manual settlement (first auctions)

How finance invoices buyers who won lots on an ATG auction (White Label `auctions.lax.bid`
or The Saleroom), and settles the consignors. Use it until automated winner import exists.

**What the integration does not do.** LAX polls ATG for lot status, bid counts, hammer prices,
paddle numbers and ATG bidder IDs (ATG tab, `atg_lot_link`, `atg_auction_link.results_snapshot`
with names removed). It does **not** create LAX bids, winners, payments, invoices, Xero records
or seller payouts. LAX's checkout (`POST /payments`) only works for a LAX winner on a sale that
ended on LAX, so ATG winners never get a LAX checkout link, and the Monday payout run never
includes ATG sales. Everything below is manual.

**Who invoices.** ATG confirmed that LAX, as the auction house, invoices every winner. ATG's
winner notification is not an invoice. Registration requirements (card checks, deposits) are
set in GAP Toolbox; if deposits are enabled, check them before invoicing (step 2).

## Roles

| Role | Who | Does |
| --- | --- | --- |
| Preparer | Finance (or an auction manager with Toolbox access) | Steps 1–5 |
| Checker | A second person with Xero access, not the preparer | Step 6 and every release of goods |

No single person may both create an invoice and confirm its payment or release the goods.

## 1. Close and freeze the results (day the auction ends)

1. Wait until every lot has ended on ATG, then click **Close on ATG** on the sale's ATG tab.
   The close job polls results once.
2. Export the results from **Toolbox** (lot number, lot status, hammer price, paddle number,
   winning bidder). Save the export in the finance share for the sale as
   `atg-results-<ATG auction ID>-<YYYYMMDD>`. This file is the source of truth; never retype
   amounts from email.
3. Compare the export with the ATG tab lot by lot: lot number, sold or not, hammer price. Any
   mismatch stops settlement for that lot until it is explained (late bid, ATG staff edit,
   poll missed). Record the explanation in the reconciliation sheet.

## 2. Identify each winner securely

- Take the winner's name, email, phone and address **only from Toolbox**. Do not accept details
  from the buyer by email, and never act on an email asking to change who pays, where goods go,
  or which bank account to use.
- Match the winner to a LAX client (Admin → Clients) by email. If none exists, ask the buyer to
  create a LAX account from the email address shown in Toolbox; until SSO exists, ATG and LAX
  accounts are separate.
- Before invoicing above `SOF_THRESHOLD_AMOUNT` (including the buyer's other unpaid and paid LAX
  purchases), follow [AML workflow](./aml-workflow.md): KYC must be approved and source of funds
  documented. Bidders registered only on ATG have not done LAX KYC.
- Check whether Toolbox shows a deposit or card authorisation for the bidder. If it does, record
  it and confirm with ATG Seller Support how it is released or applied before invoicing the full
  amount.

## 3. Create the Xero invoice

Create one invoice per winner per ATG auction, in Xero, matching LAX's automated invoices:

| Field | Value |
| --- | --- |
| Type / status | Sales invoice (ACCREC), Approved |
| Contact | The buyer's existing Xero contact (search by email first; LAX may already have created one from a legal entity); create one only if none exists |
| Reference | `atg:<ATG auction ID>` — never `payment:…`, which is reserved for LAX checkout invoices |
| Line per lot | `Auction settlement — <lot title> (lot <lot number>)`, hammer price |
| Buyer's premium | One line per lot: the sale's flat rate × hammer (ATG sales have exactly one rate) |
| Account / tax | The production `XERO_DEFAULT_REVENUE_ACCOUNT_CODE` and `XERO_DEFAULT_TAX_TYPE`, unless finance has defined different codes for premium |
| Due date | Invoice date + `XERO_INVOICE_DUE_DAYS` |

Attach the Toolbox results export. Send the invoice from Xero so the bank details come from
Xero, not from an editable email.

## 4. Collect payment

- Bank transfer to the account printed on the Xero invoice is the default. Tell the buyer, by
  phone on the Toolbox number, that LAX never changes bank details by email.
- Card: create a one-off Stripe payment link on the LAX platform account for the exact invoice
  total, with the Xero invoice number in its description. Do not use the LAX checkout.
- When money arrives, apply the payment to the invoice in Xero (bank reconciliation) and note
  the Stripe payment ID or bank reference on the invoice.

## 5. Record the references

Keep one row per lot in the sale's reconciliation sheet:

| Column | Example |
| --- | --- |
| LAX sale ID, LAX lot ID | from the admin URL |
| ATG auction ID, ATG lot ID | ATG tab (auction ID) and lot overview |
| Lot number, hammer, premium | Toolbox export |
| ATG paddle / bidder ID | Toolbox export |
| LAX client ID | Admin → Clients |
| Xero invoice number | Xero |
| Payment reference and date | Stripe payment ID or bank reference |
| Released to buyer (date, by) | step 6 |
| Seller statement / bill number | step 7 |

Store the sheet with the results export. It holds personal data: keep it in the restricted
finance share only, and delete it under the normal finance retention schedule.

## 6. Second-person check before release

The checker confirms, for every lot, before goods are released:

1. hammer price and lot status match the Toolbox export;
2. premium equals the sale's single rate × hammer;
3. the invoice contact is the Toolbox winner and the LAX client match is right;
4. AML checks passed where the threshold applies;
5. the payment is reconciled in Xero (not just "the buyer says they paid");
6. the delivery address is the Toolbox address, or a change was confirmed by phone.

The checker signs the row (name, date). Only then can collection or shipping be booked.

## 7. Settle the consignor

Seller payouts for ATG sales are not in the Monday payout run
([settlement day ops](./settlement-day-ops.md)). After the buyer's payment clears:

1. Calculate the seller amount from the hammer price and the consignment agreement's
   commission and charges.
2. Create a Xero bill (ACCPAY) for the seller with reference `atg:<ATG auction ID>:lot:<lot number>`
   and the production `XERO_PAYOUT_BILL_ACCOUNT_CODE`.
3. Pay it outside Stripe Connect (bank transfer), with the same two-person check as above.
4. Record the bill number in the reconciliation sheet.

ATG's own fees are invoiced by ATG to LAX and are not deducted from buyer invoices.

## Unsold lots and problems

- **Unsold lots** stay on the LAX sale. After Close, a sale with no sold lots is free to sell on
  LAX again; if any lot sold, duplicate the sale in LAX to relist the rest
  ([ownership rules](../integrations/atg.md#one-platform-per-sale-ownership)).
- **Buyer does not pay** by the due date: chase twice, then agree a second-chance offer or
  re-offer with the consignor. Void (don't delete) the Xero invoice and note why in the sheet.
- **Results changed after export** (ATG staff edit): stop, re-export, re-run step 1.3.

## Follow-up (not built)

Automated winner import would turn polled results into LAX winners, payments and invoices. It
needs its own design first: a reliable link from ATG bidders to LAX users (SSO or an ATG
customer reference), what bidder personal data LAX may store, how Toolbox deposits are
applied, and how seller payouts include ATG sales.
