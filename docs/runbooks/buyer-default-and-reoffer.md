# Buyer default and re-offer to the next bidder

Use this runbook when the winner of a LAX Bid lot has not paid, from the day the invoice goes
overdue until the lot has a paid buyer, or is back in inventory. It covers the staff steps, the
finance step that credits the voided invoice, and what each work inbox item asks you to do.

Lots sold on ATG (auctions.lax.bid or The Saleroom) are not covered. See
[Lots sold on ATG](#lots-sold-on-atg).

## Who can do what

| Action | Who | Notes |
| --- | --- | --- |
| Record a buyer default | Sales manager, Finance, Administrator | Step-up sign-in. A reason is required. |
| Start, send or withdraw a re-offer | Same | Send and withdraw need step-up. |
| Record the seller's answer for them | A member with `auction.manage` (Sales manager, Administrator) | Step-up and a note are required. |
| Credit the voided invoice in accounting | Finance | Within 2 working days of the default. |

Everyone else sees the Re-offer card read-only, with the line "Only Sales managers, Finance and
Administrators can act on a re-offer."

## 1. Decide it is a default

The overdue item lands in the work inbox the day after the due date, under Finance. Before you
record anything:

1. Open the lot and check the purchase. If the buyer has paid, is paying (a bank transfer reported
   as sent) or LAX is holding the payment for checks, **do not record a default**. Refund or
   resolve the payment instead. The dialog blocks these cases and says why.
2. Check for an open payment dispute or started delivery. Both block a default.
3. Remind the buyer first when the lot is only a day or two late. A default cancels the sale.

## 2. Record the buyer default

On the lot page, open **More lot actions**, then **Buyer default**. Write the reason; it is kept
with the audit entry. Choose one outcome:

- **Return to inventory.** The lot goes back to draft, unsold. Nothing else follows.
- **Offer to the next bidder.** The lot stays ended while the seller is asked and the next bidder
  is offered the lot at their own highest bid. See [Re-offer](#3-re-offer-to-the-next-bidder).

Optionally pause the buyer's bidding. In one step the system voids the invoice and payment (both
are kept, marked cancelled), cancels the purchase, removes the lot's winner, and tells the buyer
and the seller.

What the public sees from this moment: the lot, its sale's results and the archive show **Ended**,
with no price. No one outside LAX learns that a default happened, or that an offer exists.

Nothing is charged to the buyer. Any shortfall and the lost buyer's premium are worked out and
shown to staff only, on the Buyer default card. Do not tell the buyer, the seller or the next
bidder that interest, costs or the shortfall will be claimed until the lawyer has confirmed the
terms. The buyer's notice says "No fees or interest have been added for this cancellation."

## 3. Finance: credit the voided invoice (within 2 working days)

Recording a default voids the invoice **in LAX only**. The invoice written to the accounting
system when the lot ended is not touched. A VAT invoice that has been issued must be cancelled with
a credit note, never deleted. Until the accounting integration does this on its own, finance does
it by hand.

Finance, within 2 working days of the default:

1. Open the lot's Buyer default card and note the voided invoice number, the amount and the
   default date.
2. In the accounting system, find the invoice with that number. Confirm it still shows as
   unpaid.
3. Raise a **credit note for the full amount** of the invoice and apply it to the invoice, so it is
   settled and no longer overdue. Use the full amount: nothing was paid, so there is nothing to
   keep.
4. If money did arrive (a bank transfer that landed after the default), do not credit. Follow the
   refund steps in [the buyer payment flow](./buyer-payment-flow.md) and send the buyer back what
   they paid.
5. Add the credit note number to the lot's internal note, so the next person does not repeat it.

A re-awarded sale is a new sale to a new buyer: its invoice is raised separately, on acceptance, at
the new price. Never reuse the voided invoice or edit its amount.

## 4. Re-offer to the next bidder

A re-offer is one record per offer, shown as the **Re-offer card** first on the lot's Overview.
Only one offer is open on a lot at a time, and there are at most 3 offers per default.

| Step | Who | What you do |
| --- | --- | --- |
| Seller's agreement | Seller | The seller is asked in their workspace. They have 3 working days, with one reminder after 2. Silence is never a yes. |
| Send offer | Staff | Press **Send offer** once the seller has agreed. The bidder gets an email and a workspace page. |
| Accepted | Next bidder | Accepting is binding at the total shown. The lot has a new buyer and a new invoice, due in 7 days. |

**The price** is the next bidder's own highest placed bid. It is fixed and cannot be edited. A
different price is a private sale, which has its own flow.

**Who is next.** The highest bid from a different person and account than the buyer who defaulted.
Accounts that are suspended, closed or due to be deleted are skipped, with the reason recorded.
Each later offer goes to the next bidder below, at their own bid, and asks the seller again.

**LAX-owned stock** needs no seller answer. It is recorded as "LAX-owned, no consent needed" and
you can go straight to Send.

**Never** share one party's name with another. The seller sees "the next bidder"; the bidder sees
"the winning bidder".

### Recording the seller's answer for them

When the seller answers by phone, email or in person:

1. Open the Re-offer card and choose **Record seller's answer**.
2. Choose their answer. If they say no, record what they would like instead (include it in a later
   sale, return it to them, or talk to us).
3. Write a note saying how and when they answered, and by whom. A note is required.
4. Confirm with step-up. The snapshot of exactly what the seller saw is stored with the answer.

A late answer after the request has closed reopens the same request. The seller is told their
answer has been passed to the team.

### Sending the offer

1. Choose **Send offer**. The checks run again on the server when you press the button.
2. A suspended, closed or deletion-pending account blocks the send. Choose **Choose the next
   bidder** instead.
3. An account that still needs identity checks can be sent the offer. Payment waits for
   verification, as for any invoice.
4. The offer lasts 3 days and ends at 17:00 London time. You may choose 1 to 7 days.
5. Confirm with step-up. The bidder gets a reminder the day before it ends.

You can **Withdraw** an open offer, with a reason, until it is accepted. After acceptance the new
sale stands.

### After an offer ends

If the seller declines or does not reply, or the bidder declines or lets the offer end, the lot
stays ended and a work inbox item asks you to decide. Choose **Offer to the next bidder**, or
**Return to inventory**. After 3 offers, or when there is no one left, return the lot to
inventory. A seller who declined may have asked for an unsold choice: use the existing unsold
choice for the lot.

### If the new buyer does not pay

The same rules apply again from step 1 of this runbook: invoice, due date, reminders, then a buyer
default. The offer goes to the next bidder after them. The Buyer default card shows the chain in
order. Finance credits the new voided invoice within 2 working days, as above.

## 5. Work inbox items

All are under **Sales**, and Finance sees them too.

| Item | What it means | What to do |
| --- | --- | --- |
| Payment overdue | The invoice is past its due date. | Remind the buyer, or record a buyer default from the lot. |
| Re-offer: no reply from the seller | The seller has not answered, on the last day. | Chase them. If they answer by phone or email, record it. If they do not, the request closes and you decide the next step. |
| Re-offer: ready to send | The seller agreed and no offer has been sent. | Open the lot and press **Send offer**, or choose the next bidder if the checks fail. |
| Re-offer: declined or ended, decide next step | The seller or the bidder declined, or the offer ended. | Offer to the next bidder, or return the lot to inventory. |
| Re-offer accepted, invoice raised | The lot has a new buyer. Information only; it clears itself after 7 days. | Check the new invoice on the purchase, and that the buyer can pay. Nothing is required. |

## 6. Public pages and the seller's statement

- A defaulted lot shows **Ended**, with no price and no buyer, on the lot page, in the sale's
  results and in the archive. It shows **Sold for [new price]** only once the re-awarded buyer has
  **paid**. Accepting the offer is not enough: until payment it still shows Ended.
- A lot that goes back to inventory and does not sell later shows **Not sold**, as any lot does.
- The seller's **Sold & payouts** list and payout lines say the sale was "sold after the auction",
  and the payout statement reads "sold after the auction to the next bidder", without naming them.
  The seller is paid from the new sale only, when the new invoice is paid.
- The original hammer price is never shown publicly. It stays on the Buyer default card, for staff.

## Lots sold on ATG

A lot sold on auctions.lax.bid or The Saleroom has no LAX winner and no LAX bids, so the buyer
default and re-offer do not apply. The lot menu shows "Sold on ATG: follow the ATG settlement
runbook" in place of Buyer default. Finance handles an unpaid ATG winner under
[ATG manual settlement](./atg-manual-settlement.md).

## Not in this runbook

- Charging the defaulting buyer a shortfall, costs or interest. This waits for legal advice and is
  not done today.
- Private sales. See [private sale deals](./private-sale-deals.md).
- Automatic crediting in accounting. This is planned with the accounting move; until then step 3
  is manual.
