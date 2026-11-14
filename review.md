# Review: PR #1366 — Zoho Books: Shop invoices (rehearsal)

Independent money, security and UI review of branch `bk10-shop-invoices` at `141f7fa8` (Zoho Books plan v2, PR 10; migration 0383). Main was at `f5670a31` when reviewed, and the branch already contains it.

The bar was the PR 7 review (#1356, F1–F11 and their fixes) and the open PR 8 review (#1359, F1–F10). Each was checked against this PR; see "Repeats of earlier findings" below.

## How it was checked

- `corepack enable && pnpm install --frozen-lockfile && pnpm -r --filter './packages/**' build`: ok.
- A throwaway Postgres 16.15 cluster (initdb under `/var/tmp`, port 55432). `db:migrate` and `db:roles` were run on a fresh database.
- Migration 0383:
  - rollback, then forward, twice, on a copy of a migrated database that already held parked rows. All four steps ran cleanly.
  - Ordering against #1359's 0382 was checked with the real runner (see F3).
- Tests, in small batches with `--maxWorkers=2`, against the real database. The integration suites ran as `worker_app`, `api_app` and `shop_app`, and none were skipped.

  | Area | Result |
  |---|---|
  | accounting-domain | 243 passed |
  | accounting-zoho-books | 295 passed |
  | email | 239 passed |
  | types | 325 passed |
  | shop-contracts | 106 passed |
  | persistence (accounting) | 57 passed |
  | db (role contracts, roles, journal) | 113 passed |
  | worker (accounting, projectors, container) | 296 passed; my R1 and R2 fail (they show F1) |
  | worker role contracts (with `MIGRATION_TEST_DATABASE_URL`) | 449 passed |
  | shop-api (card, routes, outbox and `shop_app` reader integration) | 30 passed |
  | shop (account libs, card component, document route) | 58 passed |
  | shop-identity commerce routes | 67 passed |

  `apps/shop-api` `framing.integration.test.ts` fails 3 tests on a freshly migrated database before any test of this PR runs. It is not touched by this PR, so the failure is not from this change.

- Grants, checked with `has_table_privilege` / `has_column_privilege` after `db:roles`:
  - `shop_app` can SELECT only the card's columns of `accounting_document`, `accounting_document_copy`, `accounting_document_event` and `accounting_source_setting`. It has no access to the payload or totals, no `email_outbox_id`, and no INSERT, UPDATE or DELETE.
  - `shop_app` can INSERT into `domain_events`, but not UPDATE or DELETE.
  - `worker_app` can SELECT only the listed Shop order, line, product and guest columns. It cannot read the delivery address or phone, and has no UPDATE.
  - `api_app` and `auth_app` gain nothing on the Shop or accounting tables.
- New tests on real transactions: `tests/review1366.integration.test.ts` on this branch. It is meant to sit next to `shop-invoice-books.integration.test.ts` and was not pushed to the PR.
  1. **R1:** six concurrent senders, four rounds, against one live Shop order (contact, invoice, payment), 5 runs. **The invoice or the payment ends up `failed` in all 5 runs** (`zoho_books_contact_missing` or `zoho_books_invoice_missing`). See F1.
  2. **R2:** a single sender, with the three documents sharing one `created_at` (as happens when one projection registers them in the same millisecond). The claim follows the uuid order, and **the invoice and payment fail**. See F1.
  3. **R3:** eight orders paid in concurrent transactions. Each gets a distinct `LAX-INV-` number from the existing counter trigger, with no gaps. **Passes.**
- Mutation tests. Each guard was reverted, the listed tests were run, and the file was restored (the package was rebuilt where the worker reads it built). `git status` was clean after every run.

  | # | Guard reverted | Result |
  |---|---|---|
  | M1 | Card and download served only for `live` (`servable`) | killed (2 unit tests) |
  | M3 | Organisation must equal the bound one (`checkDestination`), the entity binding | killed (domain) |
  | M4 | Outside-UK delivery kept off the invoice (`scope === "uk"`) | killed (3 domain tests) |
  | M5 | A parked record is never requeued (`requeue`) | killed (1 domain test) |
  | M6 | The `documentId` must be this order's own document | killed (1 unit test) |
  | M7 | `getOrder` filtered by the shopper (`identity_subject_id`) | **survived** in every invoice-route and card test (pre-existing guard; see F7) |
  | M8 | Copy key limited to `accounting/london_art_exchange/` | killed (1 unit test) |
  | M9 | Lines must be the ones the event named (`sameLines`) | killed (1 unit test) |
  | M10 | Web document route: status must be 200 | survived. Harmless: the content-type check still stops every non-PDF answer |
  | M11 | Cancelled or refunded order skipped and settled (queue never stalls) | killed (batch-of-1 test) |
  | M12 | Merged account gets no email | **survived** (F7) |
  | M13 | Erased guest gets no email | **survived** (F7) |
  | M14 | Disabled account gets no email | **survived** (F7) |

  The PR's own dry-run, test_org and parking mutations (its 11) were not repeated beyond M1, M3, M4 and M5.
- UI: the screenshots on `review-notes-pr1366` `shots/round1/` were judged. They cover preparing, delayed, issued, cancelled and unchanged (lax), each at 1440 light and dark and at 375 light, plus the email at 1440 and 375.

## What meets the owner's rules

- **Dry run only.**
  - Nothing new can reach an organisation. The destination gate (`checkDestination` plus the org config's `shared_organization` refusal) is unchanged, and M3 kills it.
  - The PR's dry-run integration test sends nothing and emails no one.
- **test_org is a rehearsal for anything buyer-facing.**
  - The card is `lax` unless the mode is `live`.
  - `servable` needs `live`, a stored copy that is not a rehearsal, and the London Art Exchange prefix.
  - The email due list is `live` only. A Shop test_org copy stays off the due list even while Bid is live (PR test).
- **Art Exchange only, never the Bid organisation.**
  - `legalEntityFor("shop")` is `london_art_exchange`.
  - The adapter refuses a dependency from another product (`sameProduct`).
  - Org configs refuse two companies sharing one organisation id.
  - Binding the Shop to the Bid organisation is refused before any call (PR test, M3).
- **LAX-INV- series.**
  - The invoice carries `shop_order.invoice_number`, assigned by the existing counter trigger in the payment transaction.
  - Books gets it with `ignore_auto_number_generation=true`, and no number series is named.
  - Numbers are distinct and gap-free under concurrent payments (R3).
  - See F5 for the missing read-back check.
- **Framing from frozen data.** A framing line's price is `unit_price_pence` and its name is `framing_snapshot.name`, both frozen on the order line.
- **UK delivery line.** `uk_insured_delivery`, the collections and `lax_storage` go on the invoice at `fulfilment_surcharge_pence` with the stored `fulfilment_vat_pence`.
- **Outside-UK delivery parked.**
  - Only `international_quotation` maps to `outside_uk`. Checkout only allows that option for a non-GB address, and `uk_insured_delivery` requires GB.
  - The quote never goes on the invoice. It is stored parked straight into `needs_review` (never `pending`), with no VAT stated.
  - It is never claimed. api_app's trigger and the domain both refuse a requeue (M4, M5).
  - The payment books every penny, and leaves exactly the parked amount unapplied (checked in the domain).
- **Amounts only from stored rows.**
  - The event is ids only (order, sorted line ids, paid time). It is written with `insertInTransaction` inside `applyShopPayment`, after `claimPaymentEvent` and the `FOR UPDATE` on the order.
  - The PR test shows a rolled-back payment writes no event.
  - Lines and total come from `shop_order` / `shop_order_line`, and must add up to `total_pence` exactly, or the order is refused for a person.
- **Idempotent by LAX reference.** Six concurrent projections give one set of documents (PR test). Replays are recognised.
- **No email in dry run.** There are three independent gates: the service, the query and the PR 7 CHECK.
- **No production change.** Books stays in dry run, and the Shop card is unchanged off `live`.
- **Buyer routes.**
  - The API card and document routes load the order through `getOrder(subject, orderId)`, which filters by the shopper.
  - A missing order and someone else's order give the same 404. A foreign `documentId` is the same 404, with no storage read (M6).
  - `onSend` sets `private, no-store` on every answer, including 400 and 404 (tested).
  - The web document route turns every non-PDF answer into one uncached 404.
  - The PDF is streamed (no signed URL), with `nosniff` and a sanitised file name.

## Repeats of earlier findings

| Earlier finding | In #1366 |
|---|---|
| PR 7 F1: email queue stalls | **Not repeated.** Every Shop skip is settled (M11 killed). |
| PR 7 F2: only current payers | **Not repeated in design.** The email goes to the current owner of the order. The guards for that are untested (F7). |
| PR 7 F3: test_org as live | **Not repeated.** |
| PR 7 F4: issued date | **Not repeated.** `min(occurred_at)` of `to_state = 'issued'` is used. |
| PR 7 F5: credit notes half-built | **Not repeated.** No credit-note path was added. F6 is about refunds, though. |
| PR 7 F6: `no-store` on errors | **Not repeated.** |
| PR 7 F7: write-once email columns | **Not repeated.** The table trigger also covers Shop rows. |
| PR 7 F8: stored-attachment guard | **Not repeated.** Template set plus the `accounting/` prefix and `.pdf`. The Shop download is further narrowed to the London Art Exchange prefix. |
| PR 8 F1: parked documents need a way out | **Repeated** (F2). |
| PR 8 F2: invoice waits for its contact | **Repeated, and wider** (F1). |
| PR 8 F6: rollback re-allows requeueing parked rows | **Repeated** (F4). |

## Findings

### F1 — High — Shop documents are not ordered: invoice→contact and payment→invoice race, and the invoice or the payment fails for a person

One projection registers contact, invoice and payment, each stamped with `clock.now()`. The claim orders by `created_at, id` and checks no dependency. Main does not have #1359's `AWAITED_INVOICES_ISSUED` either, so for the Shop even payment→invoice is unordered.

- **Concurrent senders (R1):** in 5 runs out of 5, the invoice failed with `zoho_books_contact_missing` or the payment failed with `zoho_books_invoice_missing`, or both.
- **Single sender with a shared millisecond (R2):** the uuid tie-break decides the order. The invoice and payment fail.
- **Ties in my test runs:** documents shared a `created_at` in 1 of 15 projections.
- **Impact:** with Books live, a share of paid Shop orders would land in `failed` and need a person to press Try again in the right order. Meanwhile the buyer's card turns "delayed" after 30 minutes, and the buyer no longer has LAX's own invoice button (see F6). Nothing is double-booked: the lookup-before-retry still holds.

**Fix:**
- Make a document claimable only when what it refers to is `issued` for the same product, entity, provider and mode:
  - an invoice waits for its `contactReference`;
  - a payment waits for its contact and every allocated invoice.
- Put the check in the claim statement under `FOR UPDATE SKIP LOCKED`. This is the same SQL shape as #1359's `AWAITED_INVOICES_ISSUED`, extended to contacts (#1359 F2). Land it once in shared code, so the Bid and Shop flows both use it.
- Adopt R1 and R2 with strict assertions: all three issued, every run.

### F2 — Medium — A parked outside-UK delivery has no way out, and the unapplied money stays on the buyer's account indefinitely

This is the same gap as #1359 F1.
- **Parked rows can only be cancelled.** Nothing releases them, and nothing re-projects an event.
- **Re-projecting cannot help either.** The cancelled row keeps `LAX-SHOP-INV-<order>-delivery`. Re-projecting the same event is a replay. Once the treatment is decided the payload differs, so it is `reference_in_use`.
- **The payment has already applied** only the goods invoice. In Books, the quote's part sits as unapplied customer credit, with no LAX path to ever apply it.
- **The runbook** says the remainder waits "until the accountant answers", but gives no step for after the answer.

**Fix:**
- Share #1359's resolution for F1, and make it cover this reason too. Either:
  - add a release transition (parked → pending), allowed once the reason is resolved, with its own audit and trigger clause, plus a follow-up "apply payment remainder" step;
  - or use a versioned source id with an ops re-project command.
- Write the post-answer steps into the runbook, and add an end-to-end recovery test.

### F3 — Medium — Migration 0383 before 0382 stops every later migration run

The journal stamps are 0382 = `1811160000000` and 0383 = `1811246400000`.
- **The PR says** 0383 works "whether or not 0382 has run". That is true of the SQL, but not of the runner.
- **What happens:** if #1366 merges first and any database applies 0383, merging #1359 later makes `db:migrate` stop with "Migration history is missing 1811160000000 before applied timestamp 1811246400000; manual reconciliation is required". I reproduced this with the real runner.
- **Both PRs claim `idx` 374.**

**Fix:** choose one:
- Merge #1359 first, then rebase this PR (0383 becomes idx 375).
- Or, if this PR must go first, give #1359's migration a stamp later than 0383's, or drop the restated rules from 0383 and depend on 0382.

State the required merge order in both PR bodies.

### F4 — Low — Rolling back 0383 (with 0382 absent) re-allows api_app to requeue a parked delivery

When 0382 is not applied, the rollback restores 0379's trigger. That trigger allows `needs_review` + clear + no provider → `pending`, which includes parked rows. The earlier release's domain does not know `parked`.

**Failure:** after a rollback, a Try again on a parked outside-UK delivery would queue a draft with no VAT stated. That is what the owner rule forbids. Today only dry run is affected.

**Fix:** in the rollback, move parked rows to `cancelled` with an audit event before restoring the old trigger (or keep the parked clause). Say so in the header. This is the same fix as #1359 F6.

### F5 — Low — Nothing checks that Books kept LAX's number

`ZohoInvoiceGateway.issueInvoice` sends `invoice_number` with automatic numbering off, but passes no `verify`. The issued outcome compares totals only.

**Failure:** if the organisation's settings ever make Books renumber, the document is still `issued`, under Books' own number. The card, the email and the stored PDF then show a number that differs from the Shop's own invoice for the same sale, and the `LAX-INV-` series is silently broken.

**Fix:** for an invoice that carries `number`, require the read-back `invoice_number` to equal it. Otherwise return `differs` (`zoho_books_number_differs`), which holds the document for a person. Add a contract case where the simulated Books renumbers.

### F6 — Low — Buyer-facing details: a refund is shown as "cancelled", the email total is not the invoice total, and the link defaults to localhost

- **Refund shown as cancelled.** `orderCancelledAt` treats a `refunded` order as a cancelled invoice. The card says "This invoice was cancelled on … You owe nothing on it.", and both the Books download and LAX's own invoice button are withdrawn.
  - In the books, a refund is a credit note against an issued invoice (`shop_refund_settled` is not built). The invoice is not cancelled, and the buyer still needs it.
  - The email is likewise skipped for a refunded order.
  - **Fix:** confirm with the owner. Either keep the issued card (and the download) for refunded orders, or keep LAX's own invoice button whenever the Books card is not `issued`.
- **Email total.** "Total £…" in the email is `shop_order.total_pence`. For an outside-UK order, that includes the parked delivery, so it is more than the attached invoice's total.
  - **Fix:** use the issued invoice's gross, or word it "Order total".
- **Storefront URL.** `SHOP_STOREFRONT_URL` defaults to `http://localhost:3020`. If it is forgotten before going live, every Shop invoice email links to localhost.
  - **Fix:** have no default, and refuse to build the copier (or refuse to email Shop invoices) while the Shop is `live` and the value is unset or local.

### F7 — Low — Test gaps

- **Recipient guards untested.** "An erased guest or a closed account gets nothing" has no test: M12, M13 and M14 survive.
  - **Fix:** add reader integration cases for an erased guest, a disabled account, a deletion-requested account and a merged account. Each must skip with `no_recipient` and enqueue nothing.
  - **Owner question:** should a merged account's order follow the merge, rather than going unemailed?
- **Ownership filter untested.** The ownership filter of `getOrder` (M7) is not covered by any test the new routes run. The route tests mock `getOrder`.
  - **Fix:** add a `shop_app` integration case through the real repository. Another shopper's order must give the same 404 on `invoice-card` and on `invoice-documents`, with no Books read.
- **Adopt the review tests:** R1 and R2 strict once F1 is fixed, and R3.
- **Test data left behind.** The PR's seed leaves `shop_framing_option` rows (`books-…`, 48 after my runs) in a shared test database. Clean them up in `afterAll`, or seed inside a rolled-back transaction.

### F8 — Info — UI from the screenshots

- **Clean:**
  - The card sits in the Shop's own side column, uses the Shop's card, heading and link styles, and follows `html.dark`.
  - There is no horizontal scroll at 375, and the long number fits.
  - The delayed notice uses the warning tokens and is announced.
  - The copy matches the Bid card's approved strings, except that the "being prepared" line drops "You can pay now." (an owner question already in the PR).
- **The refunded state is shot as "cancelled".** See F6.
- **Fixture quirk:** that shot also shows "Edition of 24" with no number, while the others show "Edition 7 of 24". This comes from the existing Items card, not the new card, but the fixture should be fixed so the shot is representative.
- **Missing states:**
  - an outside-UK order (issued invoice with a parked delivery: what the buyer sees for the delivery);
  - the email at 1440 dark;
  - a guest order's email (the link to `/orders/guest`).
- The fixed bottom navigation overlaps content in the full-page 375 captures. This is a capture artefact, not a layout bug.

## Severity table

| # | Severity | Area | Summary |
|---|---|---|---|
| F1 | High | Ordering / money | Contact→invoice and invoice→payment are unordered; the invoice or the payment fails for a person (5/5 with concurrent senders; also with one sender on a millisecond tie) |
| F2 | Medium | Money / ops | A parked outside-UK delivery can only be cancelled; the unapplied remainder has no way to be applied (#1359 F1 again) |
| F3 | Medium | DB | 0383 before 0382 stops every later `db:migrate`; both claim idx 374, so merge order must be fixed |
| F4 | Low | DB / rules | The 0383 rollback (without 0382) re-allows requeueing a parked delivery (#1359 F6 again) |
| F5 | Low | Money | Books' read-back number is not checked against LAX's `LAX-INV-` number |
| F6 | Low | UI / copy | A refund is shown as a cancelled invoice and the downloads are withdrawn; the email total includes the parked delivery; the storefront URL defaults to localhost |
| F7 | Low | Tests | Recipient guards (M12–M14) and the ownership filter (M7) are untested; adopt R1–R3; leftover framing fixtures |
| F8 | Info | UI | Screens are clean; the refunded-as-cancelled state, an outside-UK order, and the guest and dark email are not shot |

The owner's hard rules hold:
- Books stays in dry run, and test_org is a rehearsal;
- the Shop is booked only to London Art Exchange;
- the invoice uses the Shop's own `LAX-INV-` number;
- framing and UK delivery lines come from frozen data;
- outside-UK delivery is parked and never sent;
- amounts come only from stored rows, and the projection is idempotent;
- there is no email in dry run and no production change.

F1 decides the verdict. It is the #1359 F2 defect on a flow where every order hits it, and here the payment fails too. F3 must be settled before either PR merges.

### Verdict: FIX FIRST

## Fixes after review

Fixed on `bk10-shop-invoices`. The branch is built on #1359, which is now merged to main, and main is merged in. Tests ran on a throwaway Postgres 16.15 (port 55432) after `db:migrate` and `db:roles`, with `--maxWorkers=2` in small batches; the integration suites ran as `worker_app`, `api_app` and `shop_app`.

**Mutation testing.** Each guard was reverted, the listed tests were run, and the file was restored. Packages were rebuilt where the worker reads the build. `git status` was clean after each run.

| # | Fix | Commit | Test evidence | Mutation result |
|---|---|---|---|---|
| F1 | One claim for Bid and Shop: #1359's AWAITED SQL. An invoice waits for its contact; a payment waits for its own contact (new, in the domain `documentsAwaited` and the SQL) and every invoice it pays. R1 and R2 are adopted strict (all three issued, attempts 1, every run). R3 is adopted. | `4cad5205`, `3f5c493d`, `39d6f8f8` | `shop-invoice-books.integration`: R1 (6 senders × 4 rounds × 5 runs), R2 (shared `created_at`, 5 runs), R3 (8 concurrent payments, distinct and gap-free). Persistence: a payment is not claimed before its own contact. Bid suites unchanged (34 passed). | AWAITED removed from the claim: R1 and R2 fail. Payment's contact removed from the SQL: the persistence case fails. **Killed.** |
| F2 | #1359's Release, extended to `vat_on_outside_uk_delivery`. It rebuilds the parked invoice from the order's stored delivery (`rebuildShopOutsideUkDelivery`, the same builder as the projection) with `SHOP_OUTSIDE_UK_DELIVERY_BOOKING`, which is **not set**, so Release is refused. It writes a history row, an audit entry and a trigger clause (0383), and is permission-gated (#1359's route). A remainder step applies the payment's unapplied rest once the invoice is issued. It reads the payment first (`already_applied`), runs under a row lock, and records `apply_remainder`. Runbook post-answer steps are written. | `f8ccddf7`, `4cad5205`, `82db780a`, `3f5c493d`, `39d6f8f8`, `c4aa4cc9`, `b7871d64` | End-to-end recovery test: parked → refused → booking given (test) → released, rebuilt → issued → remainder applied once, `apply_remainder` history, a repeat `already_applied`. Four workers on their own pools apply it once. Domain, Release service and contract cases. | Shop reason dropped from the redraft set: fails. Rebuild that does not park without a booking: fails. `already_applied` check removed: contract fails. Row lock removed: 3/3 fail. `planRemainder` bound removed: fails. **Killed.** |
| F3 | Merged #1359 first. 0383 is idx 375, stamped `1811246400000` after 0382's `1811160000000`. It no longer restates 0382 (as written it overwrote 0382's release function). "Merge after #1359" is in the PR body. | `27254cec`, `f8ccddf7`, `f0f531a4` | `db:migrate` on a fresh database. Journal and main-upgrade tests (23 passed). | n/a |
| F4 | The 0383 rollback moves parked outside-UK deliveries to `cancelled`, with a `cancel` history row (`{"rollback":"0383"}`) each, before restoring 0382's rule. The header says so. | `f8ccddf7` | Rollback → forward twice on a copy holding parked Shop and Bid rows: Shop rows cancelled with history, Bid rows untouched, 0382's function restored, forward re-applies. | Rollback without the cancel step: api_app could queue the parked draft (`UPDATE 1`). With it: none is left, and api_app is refused. **Killed** (by hand on a database copy). |
| F5 | An invoice that carries LAX's number must read back under it, on the send and on lookup, or it is `differs` (`zoho_books_number_differs`). | `82db780a` | Contract case "renumbered": the fake and the simulated Books renumber; held on the send, on lookup and on resend. | Number check returns null: the contract fails. **Killed.** |
| F6 | A refund does not cancel the invoice. A refunded order keeps the issued card and both downloads (Books copy, and LAX's own under Help), with "A refund was made on [day]." Its email still goes. The email total is the attached invoice's gross. `SHOP_STOREFRONT_URL` has no default: unset, not https or local means no Shop email (left due, error logged, start-up warns). | `3f5c493d`, `39d6f8f8`, `c3809081` | Card service, view-model and component tests. Copy-service tests (outside-UK total £570; unset/local/http URLs). Integration: a refunded order is emailed. Shots in `shots/round2/`. | Refund treated as cancel (card): 3 fail. Refund treated as cancel (email facts): fails. Local check removed: fails. Unset default restored: 2 fail. Order total in email: fails. **Killed.** |
| F7 | Recipient guard tests: an erased guest, a disabled account, a deletion-requested account and a merged account are each `no_recipient` with nothing enqueued. Merged is skipped, because nothing in LAX follows a merge to the surviving account (the Shop identity projection only marks the retired profile). A `shop_app` ownership integration test goes through the real order repository. The framing fixture is one option with a price per band; the per-run `books-…` options had no prices and broke `framing.integration.test.ts`. | `39d6f8f8`, `c3809081` | `shop-invoice-books.integration`: 4 guard cases plus guest. `order-invoice-ownership.integration`: another shopper gets the same 404 on the card and the download, with no Books or storage read. `framing.integration` 10 passed. | M7 (`getOrder` owner filter): fails. M12 (merged), M13 (erased) and M14 (disabled) each fail. A released delivery invoice emailed as the order's: fails. **Killed** (all previously surviving). |
| F8 | Fixture quirk fixed: lines carry shop-api's `editionSummary` ("No. 7 of 24…" while held, "Limited edition of 24…" once refunded). Shot: outside-UK order, refunded order, email 1440 dark, guest email, each light/dark/375. | (screenshots) `924ba3c3` on `review-notes-pr1366` | `shots/round2/index.md`. No horizontal scroll in any shot. | n/a |

Batch totals after the fixes:

| Area | Result |
|---|---|
| accounting-domain | 287 passed |
| accounting-zoho-books | 308 passed |
| finance-runtime | 231 passed |
| email / types / shop-contracts | 239 / 328 / 106 passed |
| persistence accounting | 69 passed |
| db roles and journal / main-upgrade | 137 / 23 passed |
| worker accounting, projectors, container | 785 passed |
| shop-api | 281 passed |
| shop | 68 passed |
| api accounting / web finance | 30 / 188 passed |

After merging main, these were re-run and passed: domain 287, worker accounting 142, db 85.

**Open for the owner.**
- The accountant's answer becomes `SHOP_OUTSIDE_UK_DELIVERY_BOOKING`.
- Books' "apply credits" request shape should be confirmed in the test organisation before the Shop goes live.

## Recheck

in progress. Branch head `f0f531a4`. Build ok; fresh Postgres 16.15, 375 migrations, roles applied. PR's `shop-invoice-books.integration` 21/21; the review's own R1/R2/R3 (strict) 3/3 runs green. Mutation tests and concurrency probes next.
