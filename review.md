# Review: PR #1375 — Zoho Books: Bid refunds as credit notes (rehearsal)

Independent money, security and UI review of `bk9-bid-refunds` (Zoho Books plan v2, PR 9, flows 8–11).

- **Reviewed at** `e97c9de5` (base `ba40ec18`).
- **Re-checked at** `629a2250`. While this review ran, the author merged main (`3c911293`, #1372) and renumbered the migration to 0385. Every result below was re-run on `629a2250` unless it says otherwise.

The bar was the #1359 and #1366 reviews, including their Recheck and Final recheck sections. The lessons applied here:
- documents ordered by what they wait for;
- parked rows need a way out, and must stay parked on rollback;
- Release must be atomic, with trigger pins;
- no silent stalls;
- every guard mutation-tested.

## How it was checked

- **Build.** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: ok.
- **Database.** Throwaway Postgres 16.15 (initdb under `/var/tmp`, port 55432). `db:migrate` (377 ledger rows, last `1811419200000`) and `db:roles` on a fresh database.
  - First on a local merge of main, renumbered by me (not pushed).
  - Then again on the PR head `629a2250`, whose renumber matches mine.
- **Tests.** Run in small batches with `--maxWorkers=2` (1 for database suites). The integration suites ran as `worker_app` and `api_app`.

  | Area | Result |
  |---|---|
  | accounting-domain | 306 passed |
  | accounting-zoho-books (contract on fake + adapter) | 318 passed |
  | types | 328 passed |
  | finance-runtime | 253 passed |
  | persistence accounting (incl. `accounting-credit-notes.integration`) | 75 passed |
  | db: api/worker/shop role contracts, migrate-roles, journal, main-upgrade, 0384 database test | 164 passed, 3 skipped (on my renumbered merge) |
  | db on head `629a2250`: main-upgrade | **3 failed** (F3) |
  | worker finance, projectors, container | 377 passed; my RV1–RV3 fail as intended (they show F1, F4, F6) |
  | api (accounting, buyer default, organisation buying, payment group) | 488 passed |
  | web (accounting, purchases, admin-accounting schema) | 218 passed |

  The PR's `bid-refunds-books.integration` (11 cases) and `accounting-credit-notes.integration` (6 cases) are green on both heads.
- **Review tests on real transactions.** File: `review1375.integration.test.ts` on this branch. It is a copy of the PR's suite plus a `review #1375` block, and was not pushed to the PR.
  - **RV1:** two delivery-refund projections on separate connections. P1 reads its facts first, P2 then runs in full, then P1 registers. See F1.
  - **RV2:** a refund credit note shaped as main's flow stored it, then the payment's next refund. See F4.
  - **RV3:** as `api_app`, a direct UPDATE moving a parked buyer-default credit note to `pending`. See F6.
- **Migration rollback.** I ran `0385_rollback.sql` and then forward, twice, on databases that held 19 and 41 parked rows and 3 and 5 `refund_credit_note` rows.
  - Parked counts and history are unchanged.
  - The CHECK came back `NOT VALID` after rollback and validated after forward.
  - The ledger went 377 → 376 → 377.
- **Grants**, from `has_table_privilege` and `column_privileges` after `db:roles`:
  - nothing changed;
  - `worker_app` reads `payment_refund.source` and `stripe_refund_id`;
  - `api_app` cannot insert a `refund_credit_note` history row (the 0382 trigger refuses it);
  - `worker_app` cannot UPDATE history.
- **Mutation tests.** Each guard was reverted, the package rebuilt where the worker reads its build, the tests run, and everything restored. `git status` was clean afterwards, apart from my test file.

  | # | Guard reverted | Result |
  |---|---|---|
  | MA | Registry over-credit check (`already + gross > invoice gross`) | killed (persistence 1, worker 1) |
  | MB | `REFUND_UNSETTLED` removed from the locked re-check in `settleExclusively` | killed (persistence 1, worker 1) |
  | MC | Credit note no longer waits for its invoice (AWAITED SQL) | killed (persistence 1, worker 1) |
  | MD | Reversed refunds not taken out (`withoutReversed` keeps the refund) | killed (worker 1) |
  | ME | Refund not capped at what the payment has left (`take = amount`) | killed (domain 3, worker 1) |
  | MH | Default credit note never parked | killed (domain 3, worker 1) |
  | MF | Adapter tops up a credit note that already holds another refund | killed (contract 1) |
  | MG | Buyer card lists credit notes that are not live with a copy | killed (api 2) |
  | MJ | Any `payment.cancelled` treated as a buyer default | killed (worker 3) |
  | MI | `listEmailDue` also lists Bid credit notes | **survived** every test (F7) |

- **UI.** Judged from the shots on `review-notes-bk9`: refunded in part, refunded in full, and cancelled after a default, at 1440 and 375, light and dark.

## What meets the owner's rules

- **Only a refund that succeeded.** `payment_refund` rows are written by the staff, card webhook, blocked capture and group paths only once the refund has gone through. A pending refund is watched and has no row. A refund taken back before the projection runs is left out with its reversal (MD). A reversal that matches no refund throws `refund_reversal_unmatched` (not retried) and goes to a person.
- **Exactly its amount, on the right lines, never more than charged** for flow 8. Every refund of the payment is replayed in order, and each is capped at what the payment still has left on the invoice, goods first (ME).
  - A Pay several lot is capped at its own member payment row.
  - The registry refuses, under a transaction advisory lock per (invoice, target), any credit note that would take the invoice's non-cancelled credit above its gross (MA). A credit note with no invoice in those books is refused.
  - Credit notes come only from `payment_refund`, never from payout or clawback lines. `payout_topup` rows are buyer refunds backfilled from refund payout lines, and are netted by the seller give-back. A refund after a payout clawback is counted once.
- **Ordering.** A credit note waits for its contact and its invoice. The rule is shared between the domain's `documentsAwaited` and the SQL `AWAITED_ISSUED` in the claim (MC). A credit note whose invoice was cancelled is parked `credited_invoice_cancelled` by the stranded sweep.
- **Idempotent by LAX reference.** Six concurrent projections of one event make one note per refund (PR test). A replay is recognised.
- **The refund from clearing happens once, and only after issue.**
  - The list takes only `issued` credit notes carrying `refund`, in the active Books modes.
  - The step holds the row with `FOR UPDATE SKIP LOCKED` and re-checks under the lock that it is still unsettled (MB). It writes `refund_credit_note` in the same transaction.
  - The adapter reads the credit note's refunds first, so a lost answer becomes `already_refunded` and any other refund is refused (MF).
  - A default's note carries no `refund`, so it is never listed.
- **Buyer default.**
  - A never-sent invoice is cancelled, and nothing is made.
  - An issued invoice gets a full credit note, parked `buyer_default_treatment` (MH).
  - An invoice in flight (`sending` or `unknown`) is retried. One held for a person is refused for that person.
  - `BID_DEFAULT_ACCOUNTING_TREATMENT` is `null`, and no treatment is invented: `void` stays parked, and Release says voiding is not built.
- **Delivery credit notes** are parked `vat_on_delivery` together with the delivery draft. `DELIVERY_BOOKING` is still `null`.
- **Release.** Release of a default's note re-reads the voided invoice and its lines `FOR SHARE` in the move's transaction (`bid_invoice` basis). It refuses when unset or `void`. The #1366 rebuild pins (contact, lines, totals) are unchanged and still apply only to parked invoices. Credit notes can only be released unchanged (see F6 for what the database allows).
- **Rollback** keeps parked rows parked. 0385 touches only the history action CHECK, and its rollback restores it `NOT VALID`.
- **Buyer routes.**
  - The card and download load the invoice through `findPayersInvoice`, which is unchanged.
  - Credit notes are matched by this invoice's own reference.
  - A foreign or missing `documentId` gets the same `invoice_not_ready` 404, with no storage read.
  - A cancelled invoice serves only its credit notes.
  - `no-store` is on every answer, including refusals (route tests).
  - Only `live` documents with a non-rehearsal copy are listed or served (MG).
- **Email.** `listEmailDue` lists invoices only, and only `live`. No credit note is emailed, and nothing is emailed in dry run (but see F7: untested).
- **No production change.** Modes, bindings and deploy files are untouched. Books stays dry run and test organisation only.

## Findings

### F1 — Medium — A courier refund can be credited more than was refunded when two projections interleave

`bidDeliveryRefundedPolicy` credits `min(refunded, charged) − sum(prior credit notes)`. The prior credit notes are read by the route before registering, outside the registry's lock. The registry only checks the total against the delivery invoice's **gross**, not against what was refunded.

**Shown by RV1:**
- The quote is charged £45. Its refunded total goes 1,500 → 3,000.
- P1 reads total 1,500 and no notes. P2 then reads total 3,000 and no notes, and registers `…-r3000` for 3,000. P1 then registers `…-r1500` for 1,500.
- Result: **4,500 credited against 3,000 refunded.** Both notes carry `refund`, so once released and issued, both would be refunded from Stripe clearing in Books.

**Why it can happen:** the projector claims deliveries one at a time with a 60 s lease, so several worker replicas run different events concurrently. A retry after a failure, or a lease expiry, has the same effect.

**Why Medium, not High:** these notes are parked `vat_on_delivery` today, and Release cannot move them until engineering extends it. Flow 8 is not affected, because it replays every refund from the stored rows.

**Fix:**
- Make the amount part of what is checked under the lock. The projection passes the prior credit it assumed (`credited`). `creditFitsInvoice` recomputes the non-cancelled credit for the invoice under the advisory lock and refuses with a retryable `credit_prior_changed` (added to `NOT_YET`) when it differs. The event is then re-projected with fresh facts.
- Alternatively, for `dlv-…-r<total>` notes, require under the lock that prior credit + this note's gross equals `<total>` capped at the charge.
- Adopt RV1 with the strict assertion (3,000 credited).

### F2 — Medium — A refund that fails after its credit note was made stays credited (and refunded from clearing), with no signal

- **The common failure path is missed.** The "taken back" guard only works if the reversal row exists **before** the projection. Stripe usually reports a refund failure days later, but `payment.refunded` is projected within seconds.
  - `payment.refund_reversed` (written with the reversal) is not routed to `accounting`.
  - The courier figure is also lowered by `lowerDeliveryRefundedInTransaction` (`group-refund-repair.service.ts`), and that is not followed either.
  - So the credit note stays registered. Once issued, it is refunded from Stripe clearing in Books for money the buyer never received.
- **A later rise can still leave the courier quote over-credited.** The policy comment says the courier's running total "only grows", but the repair can lower it. After a lowering, a later rise is credited against notes that include the failed part. Example: 3,000 credited, lowered to 1,500, then a new refund to 2,500. Nothing more is credited, so the books show 3,000 against 2,500.
- **Nothing tells anyone.** The PR lists "A refund reversed after its credit note was registered is not undone automatically" as residual risk. But no alert, failed delivery or Accounting row says it happened, which is #1359 F4's "silently" again.

**Fix:**
- Route `payment.refund_reversed` and the courier lowering's event to `accounting`.
- When a reversed refund's credit note is already registered:
  - never sent: cancel it, and re-project, so later notes are rebuilt;
  - issued: raise `accounting_refund_reversed_after_credit` and put it on the Accounting page for a person (a reversing entry is the accountant's call). Never guess.
- Correct the "only grows" comment.
- Add an integration case: refund, projected and issued, then reversal.

### F3 — Medium (merge blocker) — Migration number and the main-upgrade pin

**The clash, as found at `e97c9de5`:**
- Main's `0384_unapplied_money_dedupe_key_uid` (#1372) and this PR's `0384_accounting_credit_note_refunds` both took journal idx 376 and `when` `1811332800000`.
- `git merge origin/main` conflicted (add/add on `0384_rollback.sql`, and the journal).
- Keeping both under one stamp is not a way out: the runner stops with "Migration history diverged at 1811332800000" on any database that applied the other.

**The renumber needed, which the author has now done in `e02f1682`/`629a2250` and which I verified independently:**
- `0384_accounting_credit_note_refunds.sql` becomes `0385_…`, and the PR's `0384_rollback.sql` becomes `0385_rollback.sql`. Main's own `0384_rollback.sql` is kept.
- Journal: idx **377**, `when` **`1811419200000`**, tag `0385_accounting_credit_note_refunds`, after main's idx 376.
- `0385_rollback.sql`: the header names 0385, and the ledger delete is `created_at = 1811419200000`.
- Mentions: the migration header ("Applies after 0384"; drop the "#1372 may claim 0384" paragraph), `migrate-roles.ts` and `accounting-credit-note-refund-due.ts` ("migration 0385"), the runbook ("`0385_rollback.sql`"), and the PR body ("Migration 0384", "journal idx 376").
- **Still wrong on the head:** `packages/db/src/migration-main-upgrade.integration.test.ts` keeps `FINAL_FOLDER_MILLIS = 1811332800000`. It must be **`1811419200000`**.
  - With the head as is, 3 cases fail ("applies the complete lineage…", "preserves buyer-interest state…", "late-registered ATG sync links…").
  - With the pin at `1811419200000`, the whole file passes.
  - At `e97c9de5` the pin was `1811246400000`, also stale against the PR's own 0384. That suite was among the "240 skipped" in the PR's evidence.

With that one change, the migration side is correct: `db:migrate` gives 377 rows, and rollback and forward run cleanly twice.

### F4 — Low — Credit notes stored by main's refund flow block every later refund of the same payment

Main already projected `payment.refunded` into the same references, `LAX-BID-CN-<refund row>`, with no `refund` field and no cap. The new payload differs, so the registry answers `reference_in_use` for the old note. The whole event is then refused for a person, and the payment's next refund never gets a credit note.

Shown by RV2:

> `accounting_projection_refused:reference_in_use:LAX-BID-CN-…: that reference holds a different document`

This only affects databases where Bid was already aimed at Books (dry run or test organisation).

**Fix:** before Bid is aimed at Books with this release, cancel (with history) the Bid credit notes that lack `refund` in non-live modes, so they are re-projected. Alternatively, accept a stored note that equals the new one apart from `refund` as a replay. Name the step in the runbook, and add RV2.

### F5 — Low — A refused credit-note refund is silent

When Books refuses the refund from clearing, for example because the note already holds a different refund, the step writes `refund_credit_note` with `outcome: rejected`. That row makes the note "settled":
- `accounting_credit_note_refund_delayed` never fires for it;
- the Accounting page does not show it;
- the only trace is a `warn` log.

The runbook says "refund it by hand in Books", but nobody is told to. Meanwhile, in Books the buyer holds an open credit, and Stripe clearing does not reconcile.

**Fix:** raise `accounting_credit_note_refund_refused` (error level) through the accounting alert sink. Also list rejected `refund_credit_note` rows on the Accounting page with the runbook step, and add a test.

### F6 — Low — The database does not hold the accountant's gate for the new parked kinds

The 0383 trigger lets `api_app` release **any** parked row whose payload is unchanged. RV3 shows that `api_app` can move a parked `buyer_default_treatment` credit note straight to `pending`, while `BID_DEFAULT_ACCOUNTING_TREATMENT` is unset. The sender would then send it. The same is true of `credited_invoice_cancelled` and of a `vat_on_delivery` credit note.

The application path refuses all three, so this is defence in depth, like #1359 N2. But "never sent while unset" is an owner rule, and today only the API stands behind it.

**Fix:** in the 0385 migration, redefine `accounting_document_api_requeue_only` to refuse release of:
- `accounting_parked_buyer_default_treatment`;
- `accounting_parked_credited_invoice_cancelled`;
- a `credit_note` parked `vat_on_delivery`.

Lift each refusal in the migration that ships the accountant's answer. The 0385 rollback must restore 0383's function as it is. Add these probes to `api-app-role.contract.test.ts`.

### F7 — Low — Test gaps

- **MI survived.** Nothing fails if `listEmailDue` also lists Bid credit notes. Credit notes now get stored live copies, so one guard (`INVOICE` in that query) is all that keeps a credit note from being emailed as "your invoice".
  - **Fix:** add a persistence or worker case with a live Bid credit note copy that is never listed or emailed.
- **Adopt the review tests:** RV1 strict (after F1), RV2 (after F4) and RV3 (after F6).
- **Fix the main-upgrade pin** (F3), and run that suite with `MIGRATION_TEST_DATABASE_URL` set in the evidence.

### F8 — Info — UI and copy (from the shots)

- **Clean:**
  - The rows use the card's own document-row style.
  - Dark mode follows the tokens.
  - There is no horizontal scroll at 375, and the long credit-note line wraps cleanly.
  - The "Cancelled after a default" row uses the cancelled icon.
- **Refunded in full:** the badge still says **Paid**, and the Payment card says **Total paid £1,543.20**, beside two refund rows that add up to the same. Those come from the existing purchase header and Payment card, not this PR. A buyer will still read it as a contradiction. Owner question: show "Refunded" (or the net paid).
- **Default note row:** the title "Credit note CN-000063" is repeated in the link "Download credit note CN-000063 (PDF)". Consider "Download (PDF)" under the title.
- **Refund mode:** the refund from clearing is always `refund_mode: "Stripe"` from the deposit account. That matches how every Bid payment is deposited today, but a bank-transfer payment refunded by staff would be labelled Stripe. Accountant question.
- **Fixture:** the Progress card is empty in every shot. This is fixture only.

## Severity table

| # | Severity | Area | Summary |
|---|---|---|---|
| F1 | Medium | Money / concurrency | Interleaved courier-refund projections credit more than was refunded (RV1: 4,500 vs 3,000); the registry caps only at the invoice gross |
| F2 | Medium | Money | A refund that fails after its credit note was made stays credited and refunded from clearing; `payment.refund_reversed` and the courier lowering are not followed; no alert |
| F3 | Medium | DB / merge | 0384 clash with #1372, renumbered to 0385 on the head (verified). `FINAL_FOLDER_MILLIS` in main-upgrade must be `1811419200000`: 3 tests fail on the head |
| F4 | Low | Upgrade | Credit notes stored by main's refund flow make later refunds of that payment `reference_in_use` (RV2) |
| F5 | Low | Ops | A refused clearing refund counts as settled: no alert, no page row |
| F6 | Low | DB rules | `api_app` can move parked default, cancelled-invoice and delivery credit notes to pending unchanged (RV3) |
| F7 | Low | Tests | MI survives (credit notes kept out of email by one untested clause); adopt RV1–RV3 |
| F8 | Info | UI / copy | Fully refunded still reads "Paid / Total paid"; repeated number; Stripe refund mode for every rail |

The owner's hard rules hold on the head:
- Books stays dry run and test organisation only;
- no treatment is chosen, and `BID_DEFAULT_ACCOUNTING_TREATMENT` and `DELIVERY_BOOKING` are both `null`;
- parked rows stay parked across rollback;
- nothing is emailed in dry run, and no credit note is emailed;
- buyer routes give the same 404 with `no-store`;
- grants are unchanged and least-privilege;
- there is no production change.

F1 and F2 are money-correctness gaps in exactly the guarantees this PR claims ("for exactly that refund", "only on success"). F3's pin breaks a database suite on the head. F1 and F3 are small fixes, and F2 needs a routed event plus a person-facing signal.

### Verdict: FIX FIRST
