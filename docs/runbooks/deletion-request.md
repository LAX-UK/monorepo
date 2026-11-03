# Deletion request

Account deletion is self-service and automated. This runbook covers what staff see, what to do
when a deletion is held, and what to do when someone asks for deletion some other way. The design
and the reasoning are in [Data deletion](../security/data-deletion.md).

## The normal path (no staff action)

| When | What happens | What the person gets |
|---|---|---|
| Day 0 | The person asks in LAX Account; Identity checks Bid and Shop; the 30-day grace begins | Email with the date and a cancel link |
| Days 0-30 | New bids, registrations, checkouts and payout set-up are refused in Bid; checkout is refused in Shop; Account shows a banner | "Your account is due to be deleted on <date>. Cancel deletion to continue." |
| Day 23 | Identity queues a reminder | Email with the date and a cancel link |
| Day 30 | The daily purge re-checks both products; with nothing open it erases the person | "Your LAX Account was deleted" |
| Day 30 + | Bid, Shop, marketing and CRM follow `user.identity_deleted` and anonymise | Nothing |

Nothing needs doing for these. If a person says they did not get an email, check
`email_outbox` for the template (`account-deletion-requested`, `account-deletion-reminder`,
`account-deletion-held`, `account-deletion-completed`) and the address's suppression status.

## A deletion is held

**How you know.** A work item "Account deletion on hold" appears in the staff work inbox for client
services and administrators. It names the first thing that is open and links to the client's
record. The person has already been emailed what is open and has the same list on LAX Account's
"Delete your account" page.

**What to do.**

1. Open the client record and read the reasons. They are the products' own words: an unpaid
   invoice, an order not delivered, a payout not paid, a work being held.
2. Resolve the underlying item the usual way (chase or settle the invoice, deliver or cancel the
   order, release the hold, complete the payout). Use the matching runbook, for example
   [buyer payment flow](./buyer-payment-flow.md).
3. Do nothing else. At the next daily run the purge asks the products again and, with nothing
   open, erases the person. The work item then disappears.
4. If the person would rather keep the account, they can cancel the deletion in LAX Account at any
   time; that clears the hold.

**Do not** edit `user.deletion_held_at`, run `user_pii_purge` by hand, or delete the row. A hold
that cannot be resolved (a dispute that will run for months) is a decision for the administrator
and legal, not a reason to bypass the check.

**If a hold seems wrong.** The reasons are computed live by each product. If an item is shown that
is no longer true, fix the product data; the next run re-reads it. If a product could not be
reached the person is not marked held at all; look for `identity_deletion_purge_deferred` in the
Identity logs and check the product's `/internal/identity` route.

## Alerts and logs

- `identity_deletion_purge_run`: one line per run with `purged`, `held`, `deferred`, `reminded`.
- `identity_deletion_held`: a new hold, with the reason codes.
- `identity_deletion_purge_deferred`: a product could not be asked; the person was left for the
  next run.
- `identity_deletion_purge_subject_failed`: an unexpected failure for one person; the rest of the
  run carried on.
- `auth_security_effect_abandoned`: a reminder or confirmation email gave up after its retries.
  The abandoned job no longer holds the person's address. Check email delivery
  ([email provider incident](./email-provider-incident.md)).

## A request that did not come through the product

1. Verify the requester: a reply from the account's email address and a match against a recent
   order or payment.
2. Ask them to use LAX Account (Security, Delete your account). The checks and the 30 days are the
   same for everyone, so there is no faster staff route. If they cannot sign in, help them recover
   the account first ([account recovery](./auth-go-live-rollout.md)).
3. Record the request and the date in the client's notes.

Within one month of the request the person must have been erased or told why not. A held deletion
satisfies that, because the email states the reason and the date of the next check.

## Retention that overrides erasure

Source-of-funds evidence is kept for five years after case resolution
([AML workflow](./aml-workflow.md)); KYC records follow their own five-year purge. Both are kept
while the personal profile is anonymised. Say so if the person asks.

## Before production

The wording of the held-deletion page, email and staff line is in
`packages/identity-contracts/src/deletion-hold-copy.ts`. Legal should review it, and confirm the
position that we keep details while a contract or legal claim is open and tell the person why.
