# Buyer default, credit notes and refunds: audit against the owner's rules

Status: audit of `main` at `5af55edf` (2026-11-19). The guards for all three rules are in this PR as
pure domain code. Wiring them in needs migrations and two staff screens, which wait for design
approval (see "PR plan").

## The rules (owner, 2026-11-19)

1. **Credit note, never void, once sent.** A sent invoice is always cancelled by a credit note.
   Void is only for an invoice raised in error and never sent to the buyer.
2. **Late payment means a new invoice.** If a buyer pays after the credit note, the credit note
   stays. A new invoice is issued for the same lot and the payment is recorded against it.
3. **Refunds go back to the source account (AML).** Bank-transfer refunds go only to the account
   the money came from. Stripe bank-transfer payments are refunded through Stripe. Direct bank
   payments need a staff request in LAX Admin plus approval by a second, different staff member.
   They are then recorded in the books against the credit note (Xero today, Zoho Books dry-run).

## Summary

| Rule | Matches | Size of gap | Needs migration | Needs new screen |
| --- | --- | --- | --- | --- |
| 1 Credit note, not void | Partly | Medium | Yes (lift the 0385 guard) | No |
| 2 Re-invoice after credit note | No | Large | Yes (link the new invoice) | Yes (Bid admin action) |
| 3a Refund to source account (Stripe) | Partly | Medium | No | No |
| 3b Direct bank refund, two staff | No | Large | Yes (request table) | Yes (LAX Admin request and approve) |

Because rules 2 and 3b need new screens and tables, this PR contains only the doc and the
guards (`packages/accounting-domain/src/buyer-default-rules.ts`). The guards are tested and not
called from anywhere yet. They change no behaviour.

## Rule 1: a sent invoice is credited, never voided

| Where | File:line | Matches | Gap |
| --- | --- | --- | --- |
| Buyer default marks the Bid invoice cancelled in LAX | `packages/persistence/src/repositories/drizzle-buyer-default.repository.ts:143-153` (`voided_at = now()`), payment set `cancelled` at `:133-139` | Partly | The local flag is named `voided_at` and the schema comment says "the invoice it voided" (`packages/db/src/schema/buyer-default.ts:20-24`). Every Bid invoice is shown to the buyer as soon as it is raised (purchase page, "Your invoice" email, `packages/persistence/src/repositories/accounting/drizzle-bid-invoice-email-facts.reader.ts:30-100`), so a defaulted invoice is always a *sent* invoice. Locally it works as "cancelled", and the books side decides void or credit note, so no data change is needed. Only the naming and copy are misleading. |
| Service that records the default and publishes `payment.cancelled` | `apps/api/src/services/buyer-default/buyer-default.service.ts:77`, `:117`, `:200-204` | Yes | None. The event drives the books flow below. |
| Books projection for a buyer default (`bid_buyer_default`) | `packages/accounting-domain/src/projection/bid-refunds.ts:405-475` | Partly | `issued`: a full credit note is built (`:438-470`). That is right. **But it is parked** (`buyer_default_treatment`, `:470-473`) because `BID_DEFAULT_ACCOUNTING_TREATMENT` is `null` (`:368`). The owner has now answered "credit note". `waiting` (never sent to the books, `:432-433`): the queued books invoice is cancelled and no credit note is made. The buyer did receive the LAX invoice and its number, so under rule 1 this should also end in a credit note, not a silent cancellation. |
| The `void` option | `packages/accounting-domain/src/projection/bid-refunds.ts:366`, `packages/finance-runtime/src/books/accounting-queue.service.ts:307-312` | No (conflicts) | `"void"` is offered as a treatment. Rule 1 rules it out for a sent invoice. Remove it. |
| Database guard on parked default credit notes | `packages/db/drizzle/0385_accounting_credit_note_refunds.sql:41-49` | Blocks the fix | `api_app` may not move a note parked `accounting_parked_buyer_default_treatment`, not even to release it. The file itself says "the migration that ships the answer lifts the matching line". So turning rule 1 on **needs a migration**. |
| Xero (live books today) | `packages/finance-runtime/src/accounting/xero-invoice-writer.ts:42-70` (Xero invoice made when checkout starts, `apps/api/src/services/payment/checkout-orchestrator.ts:205-226`) | No | A buyer default writes nothing to Xero. An invoice made in Xero when the buyer opened checkout stays AUTHORISED (owed) after the default. It is neither voided nor credited. Xero needs an ACCRECCREDIT for the full invoice, allocated to it. |
| Zoho Books (dry-run) | `packages/accounting-zoho-books/src/adapter/dry-run.ts:52-60` and the queue above | Partly | Same as the projection: the credit note is rehearsed but parked. |
| Voiding by hand | none found | n/a | No staff action voids an invoice. If one is ever added it must call `checkVoid` (this PR), which allows a void only for an invoice raised in error and never sent. |

**Guard in this PR:** `checkVoid` / `cancellationOf`. A sent invoice gets `invoice_sent`. An unsent
invoice that was not raised in error gets `not_raised_in_error`. Only "raised in error and never
sent" may be voided.

## Rule 2: a payment after the credit note goes on a new invoice

| Where | File:line | Matches | Gap |
| --- | --- | --- | --- |
| Payment for a cancelled invoice, in the books | `packages/accounting-domain/src/projection/bid-payments.ts:180-208` (single), `:250`, `:284` (Pay several) | No | Parked `invoice_cancelled`. The comment offers two ways out: refund, or "reinstate the invoice in Bid and release the payment". Reinstating conflicts with rule 2: it would undo the credit note's effect and apply the money to the cancelled invoice. |
| Books facts for a cancelled invoice | `packages/persistence/src/repositories/accounting/drizzle-bid-accounting-facts.reader.ts:50-56`, `:76-78` | No | A cancelled invoice is only named, never rebuilt. There is no "invoice that follows a credited invoice". |
| Can a payment still arrive? | Stripe bank transfer funds the customer cash balance (`apps/api/src/services/stripe/stripe-payment-gateway.ts:212-220`), and money on a closed invoice opens an unapplied-money task (`apps/api/src/services/payment/unapplied-money-handling.service.ts:24-90`, `apps/worker/src/projectors/notification-fanout/unapplied-money-fanout.ts`) | Partly | The money is caught and shown to finance. The only outcomes are refund, "mark handled" or "reinstate". There is no "raise a new invoice for this lot and apply this money". |
| New invoice for the same lot | `packages/db/src/schema/bid-invoice.ts:52-56` (one *live* invoice per lot and buyer, `voided_at is null`) | Partly | The schema already allows a second invoice for the same lot and buyer once the first is cancelled. It has no column saying which invoice it follows, so the audit trail and the buyer's purchase page cannot link them. That needs a migration. The lot itself has `winner_id` cleared by the default (`drizzle-buyer-default.repository.ts:166-170`) and may already be re-offered or back in inventory. Re-invoicing has to check that the lot is still free, and that is a staff decision. |
| Staff action | none | No | Bid admin has no action for it. It needs a new action, "Re-invoice to the buyer who paid", on the buyer default card (`apps/web/src/components/admin/reoffer/buyer-default-card.tsx`) or the unapplied-money work item. That is a new interaction and needs design. |

**Guard in this PR:** `planReinvoiceAfterCreditNote`. It refuses when the invoice was not credited,
when the money came from another buyer account (`payer_mismatch`, refunded instead), on an
overpayment, and on amounts that are not whole pence. Otherwise it keeps the credit note and plans a
new invoice for the same lot, buyer and total, with the key `reinvoice:<invoice>:<payment>`, and
applies the payment to it.

## Rule 3: refunds only to the source account; direct bank refunds need two staff

### 3a. Stripe payments (card and UK bank transfer)

| Where | File:line | Matches | Gap |
| --- | --- | --- | --- |
| Bid staff refund | `apps/api/src/services/payment/payment-refund-ops.ts:23-117` (`refundPayment`), `:119-180` (manual review) | Partly | Refunds go through Stripe by `charge` (good: no account is ever typed in). One staff member with `finance.platform.write` can refund. That is allowed by rule 3, which asks for two staff only for direct bank payments. Nothing checks whether the charge was a bank transfer whose sending account Stripe did not report (see Stripe below). |
| Stripe refund call | `apps/api/src/services/stripe/stripe-payment-gateway.ts:138-181` | Partly | `refunds.create({ charge, amount })` is idempotent (`refund:<charge>:<payment>:<amount>`) and has no `origin` or `instructions_email`. For a `customer_balance` charge, Stripe returns the money to a bank account and may email the buyer for the account details. |
| Private sale deal refund | `apps/api/src/services/private-sale-deal/deal-reversal.service.ts:100` | Yes (fails closed) | A direct bank payment (`bankReference`) is refused (`bank_transfer_payment`). It is never refunded by Stripe to a card or other account. There is no way to request one, though (3b). |
| Shop (LAX Admin) refunds | `apps/shop-api/src/infrastructure/handlers/admin/request-refund.handler.ts:40-160`, `apps/shop-api/src/infrastructure/scheduler/submit-pending-refunds.runner.ts`, UI `apps/shop-admin/src/components/orders/refund-dialog.client.tsx` | Partly | Shop orders are paid by Stripe only, and the refund is submitted against the payment intent. Single staff in the UI. Two-person approval exists only in the ops CLI above an amount (`apps/shop-api/src/scripts/shop-ops.ts:71-90`, rule in `packages/shop-domain/src/staff-action-rules.ts:9-35`). |
| Xero refund recording | `packages/finance-runtime/src/accounting/xero-payment-recorder.ts:130-198` | Partly | It records a credit note for a Stripe refund. The amount is a pounds string parsed with `parseFloat` (`:158`), not integer pence (small fix). It always books against `XERO_PAYMENT_BANK_ACCOUNT_CODE` and never against the cancelling credit note. |
| Zoho credit-note refund | `packages/accounting-domain/src/credit-note-refund.ts:12-22`, `packages/accounting-zoho-books/src/adapter/credit-note-refund.ts:58-103` | Partly | Refunds the credit note once, keyed by its reference (good). Only `account: "stripe_clearing"` exists, so a direct bank refund cannot be recorded. |

**How Stripe refunds UK bank-transfer (customer balance) payments.** These are Stripe's
documented terms:

- A customer balance (bank transfer) payment can be refunded to the customer's bank account or
  back to their cash balance (`origin: "customer_balance"` with the customer)
  ([Stripe: Refund bank transfer payments](https://docs.stripe.com/payments/customer-balance/refunding)).
- To send it to a bank account, Stripe needs the customer's account details. "Sometimes Stripe
  receives the customer's bank account details when performing the transfer". When it does not,
  Stripe emails the customer at the customer's email, or at `instructions_email`, to collect them.
  Creating the refund fails if the customer has no email (same page).
- When Stripe cannot complete the refund, its status is `requires_action` and the funds must be
  returned outside Stripe (same page; see also [Refunds](https://docs.stripe.com/refunds)).
- Background on the rail: [Bank transfer payments](https://docs.stripe.com/payments/bank-transfers).

**Is the original account guaranteed? No.** When Stripe received the sender's details with the
transfer, the refund goes there. When it did not, the buyer is emailed and may enter any account.
That breaks the AML rule. A `requires_action` refund also leaves the return to us, outside Stripe.

Note: the Stripe docs could not be fetched from this environment (docs.stripe.com is blocked by
the session's network policy). The points above come from Stripe's published pages via search.
Re-check the exact wording before the wiring PR.

**Guard in this PR:** `lockRefundDestination(source, requested?)`:

- card: refunded through Stripe only.
- Stripe bank transfer: refunded through Stripe only when Stripe reported the sending account
  (`expectedAccount`). Otherwise it is refused with `source_account_unknown`, so a person checks
  the source first instead of letting Stripe email the buyer for an account.
- direct bank: locked to the sending sort code and account number.
- In every case, a typed-in account that differs from the source is refused
  (`destination_not_source`).

### 3b. Direct bank payments

| Where | File:line | Matches | Gap |
| --- | --- | --- | --- |
| Request and approval | none | No | No table, service or screen exists for a direct bank refund. The only "refunded outside" record is Shop's `mark-refund-settled-outside` (`apps/shop-api/src/infrastructure/handlers/admin/mark-refund-settled-outside.handler.ts:42-180`, dialog `apps/shop-admin/src/components/orders/refund-outside-dialog.client.tsx`). It is one staff member, records no destination, and is meant for a failed Stripe refund. It is not this flow. |
| Source account on record | `packages/db/src/schema/payment-transfer-reference.ts`, deal `bankReference` | No | The sending sort code and account number of a direct bank payment are not stored. They are needed to lock the destination. |
| Books recording against the credit note | Xero: `xero-payment-recorder.ts:130`; Zoho: `credit-note-refund.ts:21` | No | Neither records a refund paid from the bank account against the cancelling credit note. |

**Guards in this PR:** these run in order.

1. `requestDirectBankRefund` checks:
   - the rail is direct bank;
   - the amount is positive whole pence;
   - the amount is no more than what is left on the credit note;
   - the reason is 10 to 1000 characters;
   - the destination is locked to the source;
   - the request has an idempotency key.

   It starts the audit trail.
2. `approveDirectBankRefund` refuses the requester (`approver_is_requester`, ids trimmed). A repeat
   approval by the same approver returns the record unchanged. A different third person is
   refused (`already_approved`).
3. `recordDirectBankRefundInBooks` only accepts an approved refund. It records against the credit
   note's reference with the day paid, and is idempotent.

## PR plan (waits for design approval)

1. **Rule 1 on (migration + small code).** Set `BID_DEFAULT_ACCOUNTING_TREATMENT = "credit_note"`
   and remove `"void"` from `BID_DEFAULT_TREATMENTS`. Add a migration that lifts the
   `accounting_parked_buyer_default_treatment` line from 0385's guard, so staff can Release the
   notes already parked. Change the `waiting` case to send the invoice and then its credit note
   when the LAX invoice has a number. For Xero: on `payment.cancelled` with a Xero invoice, write
   a full ACCRECCREDIT and allocate it to that invoice (idempotency key
   `xero-default-cn:<invoice>`). Rename the "voided" copy to "cancelled (credit note)" in
   staff and buyer text. Tests: bid-refunds projection, `bid-refunds-books.integration.test.ts`,
   and the migration contract test.
2. **Rule 2 (migration + design).** Migration: `bid_invoice.follows_invoice_id uuid null
   references bid_invoice(id)`, unique where not null. Service:
   `BuyerDefaultReinvoiceService.reinvoice({ creditedInvoiceId, paymentId, actor })`. It calls
   `planReinvoiceAfterCreditNote`, locks the lot, and refuses if the lot is re-offered, sold or
   in another sale. It raises the new invoice with copied lines in one transaction, applies the
   payment, writes an audit entry and emits `bid.invoice.raised`. The projection then books the
   new invoice and releases the parked payment against it. Screen: an action on the buyer default
   card and the unapplied-money work item, built from the staff-ui kit's confirm dialog. Design
   needs to decide where it sits and its copy.
3. **Rule 3a (small code, no screen).** In `refundPayment`, read the charge's
   `payment_method_details.type`. For `customer_balance`, read the funding transaction's sender
   details. Call `lockRefundDestination` and refuse `source_account_unknown` with a typed error
   that points staff to the direct bank flow. Watch `requires_action` refunds into the same flow.
   Change Xero refund amounts to integer pence.
4. **Rule 3b (migration + design).** Migration: `direct_bank_refund` (`id`,
   `idempotency_key unique`, `credit_note_reference`, `amount_pence integer > 0`, `sort_code`,
   `account_number` (encrypted at rest), `reason`, `requested_by`, `approved_by` with a check that
   `approved_by <> requested_by`, `status`, `paid_on`, timestamps) plus append-only audit rows.
   Also store the sender account on direct bank payments. Screens in LAX Admin, from the staff-ui
   kit: a "Request bank refund" dialog on the credit note or order, and an approvals list for a
   second staff member with the same capability. Books: Xero bank-paid refund on the credit note,
   and Zoho `CreditNoteRefund.account: "bank"` in the dry-run adapter.

Each step is its own PR with integer pence, idempotency keys, an audit trail, typed errors and
tests, including the same-person refusal at both the database and the service.
