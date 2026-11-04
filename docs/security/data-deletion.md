# Data deletion

Deleting a LAX Account is automated end to end. A person asks for it in LAX Account (or in LAX Bid,
which calls the same Identity service), waits out a 30-day grace period, and is erased by a daily
job. Staff step in only when the job holds a deletion, or when a request arrives by another route.
The day-to-day steps are in [the deletion request runbook](../runbooks/deletion-request.md).

## What happens

1. **Request.** Identity asks Bid and Shop what the person still has in flight there (open orders,
   unpaid wins, unpaid payouts, open payment disputes, holds). If either product names something, or cannot be reached,
   nothing starts and the person is shown what to resolve. Otherwise the 30-day grace period begins
   and Identity publishes `user.deletion_requested`. The person gets an email that says the date
   and links to cancel.
2. **Grace period.** The person can cancel in LAX Account at any time (`user.deletion_cancelled`).
   While the request stands:
   - LAX Account shows "Deletion scheduled for <date>" on every page, with a cancel link.
   - Bid refuses placing a bid, setting a maximum or an absentee bid, registering for a sale,
     starting checkout and starting a payout account. Shop refuses checkout. Both answer 403 with
     "Your account is due to be deleted on <date>. Cancel deletion to continue." and the code
     `account_deletion_pending`. Each product learns of the request from the Identity events above
     (`bid_identity_directory.deletion_requested_at`, `shop_user_profile.deletion_requested_at`),
     so the rule is enforced by the product's API, not only its screens.
   - Seven days before the end, Identity sends a reminder with a cancel link.
3. **Daily purge.** Identity's schedule (`apps/auth`, once a day and at start-up) works through
   everyone whose grace period has ended. For each person it asks Bid and Shop again, with the same
   question as at the request, because the answer a month ago may no longer hold.
   - **Nothing open:** the person is erased (see below).
   - **Something open:** the person is **held**. Their details are kept, the reasons are recorded,
     the person is emailed what is open and when it will be checked again, and staff get a work item.
     The purge looks again every day.
   - **A product cannot be reached:** nobody is erased on silence. The person is left for the next
     run and is not marked held.
4. **Erasure.** In one transaction Identity copies the person's email address into the durable
   security-effects outbox, scrubs the account (`user_pii_purge`: name, email, phone, image,
   addresses, credentials, sessions, tokens, devices, consents) and publishes
   `user.identity_deleted`. The user row stays, anonymised, so orders, invoices and payments keep
   their references. Identity then ends relying-party sessions and sends back-channel logout.
5. **Confirmation.** The outbox sends "Your LAX Account was deleted" to the copied address. The
   outbox row is deleted once the message is sent (and its address removed if the job is ever
   abandoned), and the worker clears the stored recipient from the email outbox row after sending.
   The message carries no name or other personal detail.

## Fan-out to the products

`user.identity_deleted` is followed by every product, which anonymises what it holds:

| Product | How | Field list |
|---|---|---|
| Bid | worker projector `bid_personal_data_anonymisation` | `apps/worker/src/anonymisation/bid-personal-data-policy.ts` |
| Shop and lax.art | shop-api task `personal-data-anonymisation` | `apps/shop-api/src/infrastructure/identity-purge/shop-personal-data-policy.ts` |
| Marketing, CRM | worker lifecycle consumers | `docs/integrations/marketing-contacts.md`, `docs/integrations/zoho.md` |

Rows that only describe the person are deleted. Rows that financial, legal or auction records point
at stay, with personal fields cleared or replaced by the pseudonym `Deleted user XXXX`. Each product
records `bid.user_anonymised` or `shop.user_anonymised` with the subject id, the time and the row
counts, and no personal data. Every step is idempotent, so a replay changes nothing further.

## Held deletions

A deletion is held when a product names something open at purge time, for example an unpaid invoice
for a lot the person won, an order not yet delivered, or a payout not yet paid. The default position
is that we keep the details we need to complete a contract with the person or to deal with a legal
claim, we tell them what is open, and we tell them when we will look again. The wording the person
sees (page, email, staff line) lives in one file,
`packages/identity-contracts/src/deletion-hold-copy.ts`, so it can be reviewed and changed in one
place.

- Identity records `deletion_held_at` and `deletion_hold_reasons` on the user row and publishes
  `user.deletion_held`. Bid mirrors it in `bid_identity_directory` and lists it in the staff work
  inbox as "Account deletion on hold" (client services and administrators).
- A hold clears when the person cancels, or when the purge next finds nothing open and erases them.
- Staff never need to run the purge by hand. Resolving what is open is enough; the next daily run
  erases the person.

An erasure request must be answered within one month. A held request keeps the person informed at
each change and is closed as soon as the obligation is, so the hold lasts only as long as the
obligation does.

## Retention that overrides erasure

**AML evidence.** Source-of-funds evidence (`source_of_funds_document`, `retentionClass: aml_5y`)
must not be erased within five years of case resolution (UK MLR, GDPR Article 17(3)(b)). The
products keep those objects and audit events until `purgeSourceOfFundsDocumentsJob` runs after the
window, while the personal profile fields are still anonymised.

**KYC records** follow their own five-year retention purge.

**`domain_events`** is append-only. Payloads carry as little personal data as possible so retained
audit rows do not hold more than they need.

## Requests that do not come through the product

For a request by email or post, verify the requester's identity first (a reply from the account's
email address plus a check against a recent payment or order). Then ask them to use LAX Account, or
raise it for them through Bid's staff tools if they cannot. Do not delete rows by hand: the
automated path is the one that keeps products, CRM and retention rules in step.
