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

## Fixes after review

Fixed on `bk9-bid-refunds`, head `d268da93`. Commits: `99b3b441` (F3), `a631e23f` (F6), `3915bbce` (F1, F2, F4, F5), `307fc1cf` (F1 and F2 tests, F7), `d268da93` (F8). Re-checked on a throwaway Postgres 16.15 (port 55432) with `db:migrate` and `db:roles`. Integration suites ran as `worker_app` and `api_app`, on real concurrent transactions. Each mutation reverted one guard, rebuilt the package the worker reads, ran the tests and restored the guard; `git status` was clean afterwards.

| # | Fix | Commit | Test | Mutation |
|---|---|---|---|---|
| F1 | A credit note carries the basis it was built from (`CreditBasis`). Under the invoice's credit lock, in the registering transaction, the registry re-reads the other credit and, for a courier refund, `payment_group_delivery.refunded_pence`. Anything different refuses the note as `credit_prior_changed` (in `NOT_YET`, re-projected from fresh facts). A courier refund's notes may never total more than the refunded total (`credit_exceeds_refunded`). `worker_app` has no UPDATE on `payment_group_delivery` and grants were not widened, so the serialisation is the existing per-(invoice, target) document-group lock. | `3915bbce`, `307fc1cf` | RV1 adopted strict: P1 is refused, then makes nothing, and 3,000 is credited. A stress test (4 totals × 3 projections each, at once, retried) credits exactly 4,500. Also: a total raised while slow; a note cancelled while slow; the registry ceiling with a matching basis. | N1 (other credit not re-checked), N2 (total not re-read), N3 (ceiling): each killed. N1 and N2 first **survived** on RV1 alone, because each backs up the other; they are now killed by their own tests. |
| F2 | `payment.refund_reversed` and `payment_group.refund_reversed` are routed to `accounting` (catalogue and routes). New flow `bid_payment_refund_reversed`. A never-sent credit note of a taken-back refund is cancelled. An issued one is **held** (new life-cycle move `hold`: issued → needs_review, the Books document kept, never requeued, released or cancelled; history action `hold` in 0385) as `accounting_refund_reversed_after_credit`, with an error alert and a Needs a person row. The plan defines no reversing document, so nothing is reversed in Books. A lowered courier total cancels the newest never-sent notes until the credit fits and credits the rest again; an issued one is held. A reversal waits for registrations in progress (`awaitCreditRegistrations`), and flow 8's basis is the payment's refund rows. A stored refund note is reused as is, so a reversal never reshapes the other notes. The "only grows" comment is corrected. | `3915bbce`, `307fc1cf` | Never sent → cancelled, the others unchanged, and only the stayed refunds refunded from clearing. Issued → held, alert once, never refunded from clearing, page count. A projection that read the refund before the reversal is refused. A reversal while a registration is mid-transaction (history table held by a blocker) waits, then cancels. Courier lowered 3,000 → 1,500 → raised to 2,500 credits 2,500. Domain cases for both policies and `hold`. | N4 (refund rows), N5 (no wait), N6 (no cancel), N7 (no hold), N8 (lowering no cancel), N9 (no alert): all killed. |
| F3 | Migration stays 0385 after main's 0384. `FINAL_FOLDER_MILLIS = 1811419200000`. | `99b3b441` | main-upgrade: 23 passed with `MIGRATION_TEST_DATABASE_URL` set. `db:migrate` on a fresh database: 377 rows. On a database first migrated with main's own folder: 376 → 377, then `db:roles`. `0385_rollback.sql` then forward, twice: 377 → 376 (CHECK `NOT VALID`, the new refusal kept) → 377 (validated). | Old stamp: 3 cases fail. |
| F4 | Flow 8 gets the credit notes already registered for the invoice (`registered`). A refund whose note is stored keeps it exactly as stored (a replay), so a note stored by main's flow without `refund` is recognised, and the next refund is credited after it. Runbook: such notes carry no refund from clearing (dry run and test organisation only). | `3915bbce` | RV2 adopted: `projected`, the new note is 1,000, and the old note is untouched. Domain: a stored note is reused, and a taken-back refund leaves the others as stored. | N10: killed (domain 2, worker 1). |
| F5 | A refused refund from clearing writes `refund_credit_note` (rejected) **and** holds the credit note (`accounting_credit_note_refund_refused`) in the same transaction. Error alert `accounting_credit_note_refund_refused`. The Accounting page text tells the person to refund it by hand in Books. The runbook covers it. | `3915bbce` | A refusing port: held, alert raised, not tried again, counted in Needs a person. | N11 (no hold), N12 (no alert): killed. |
| F6 | 0385 redefines `accounting_document_api_requeue_only` as 0383's function plus one refusal: api_app may not move a credit note parked as `buyer_default_treatment`, `credited_invoice_cancelled`, or `credit_note` + `vat_on_delivery`, not even unchanged. **Deviation from the F6 text:** the rollback restores 0383's function **with this refusal kept** (as 0383's own rollback kept outside-UK delivery parked), so those notes stay parked under the earlier release. The PR's default Release integration case now expects 42501 from the database. | `a631e23f` | api_app contract probes for all three (release and any other move: 42501), with the delivery invoice beside them still releasable. A static test checks that the function is 0383's word for word plus the refusal, in both the migration and the rollback. RV3 adopted. | Function swapped back to 0383's: the contract case fails; restored: 24 passed. |
| F7 | — | `307fc1cf` | A live Bid credit note copy is neither in `due` nor in `unreadable` from `listEmailDue`, while the invoice beside it is listed. | MI (`INVOICE` clause removed): killed. |
| F8 | A purchase whose Books refund credit notes credit the whole invoice reads **Refunded** (badge, status, Payment total label), never "Paid / Total paid". A refund reads "Refunded −£x to your card" or "… to your bank account" from `paidWith`: a Pay several charge by its `checkout_rail`; one payment only when its checkout sessions all name one rail; otherwise nothing is said. A default's credit note row is "Credit note CN-…" with "Download (PDF)". Books' `refund_mode` is unchanged ("Stripe", from Stripe clearing). The bank-transfer case stays the accountant's question, and no answer is invented. | `d268da93` | web view-model cases (full, part, default, none; per rail); api pass-through; integration `paidWith` (none, bank, two rails → null, group → card). Shots: `review-notes-bk9`, `shots/round2` with `index.md`, 12 shots, no horizontal scroll at 375. | N13 (still reads Paid): killed (web). N14 (two rails read as one): killed (worker). |

**Runs on the head:**

| Area | Result |
|---|---|
| accounting-domain | 317 passed |
| accounting-zoho-books | 318 passed |
| types | 329 passed |
| finance-runtime | 253 passed |
| persistence accounting and lib | 204 passed |
| db contracts, migrate-roles, 0385 | 127 passed |
| main-upgrade | 23 passed |
| worker accounting integration | 84 passed, then `bid-refunds-books` 25 passed |
| worker unit | 375 passed |
| api organisation buying | 285 passed |
| web purchases | 361 passed |

**Still open:**

- A cancelled courier step's reference stays taken. Raising a lowered total back to exactly that figure with a different amount goes to a person as `reference_in_use`.
- A held credit note still counts against the invoice, so a later refund of the same money waits until a person settles it.
- Accountant questions: defaults, VAT on delivery, reversing an issued credit note, and the bank-transfer refund mode.

## Recheck

An independent re-review of head `d268da93` (base `3c911293`, which main has not moved past). I did not change `bk9-bid-refunds`. Each fix was checked from the code and from my own runs, not from the notes above.

### How it was checked

- **Build.** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: ok.
- **Database.** Throwaway Postgres 16.15 (initdb under `/var/tmp`, port 55432). `db:migrate` on a fresh database gave 377 ledger rows, last `1811419200000`, then `db:roles`.
- **Tests**, run with `--maxWorkers=2`, or 1 for database suites. Integration suites ran as `worker_app` and `api_app`.

  | Area | Result |
  |---|---|
  | accounting-domain | 317 passed |
  | types | 329 passed |
  | persistence accounting and lib | 205 passed |
  | db: `api-app-role.contract`, `migration-0385`, `migration-main-upgrade` (with `MIGRATION_TEST_DATABASE_URL` set, none skipped) | 51 passed |
  | worker: `bid-refunds-books.integration` | 25 passed. This includes RV1 strict, the many-projections stress case, the reversal while a registration is mid-transaction, the courier lowering, F5 and RV3. |
  | worker finance and projectors | 368 passed |
  | api organisation buying and its routes | 292 passed |
  | web purchases | 78 passed |

- **Migration.** `FINAL_FOLDER_MILLIS = 1811419200000` (`packages/db/src/migration-main-upgrade.integration.test.ts:26`), and the main-upgrade suite passes.
  - I ran `0385_rollback.sql` and then forward (`db:migrate` and `db:roles`) **twice**, on a database holding:
    - 31 parked rows;
    - 3 held rows (needs_review with a Books document);
    - 8 `hold` or `refund_credit_note` history rows.
  - Each time the ledger went 377 → 376 → 377.
  - The action CHECK came back `NOT VALID` without `hold` after rollback. On the earlier release, a new `hold` history row is refused by the CHECK. After forward the CHECK was validated.
  - Parked and held counts and history were unchanged. The function body was byte-identical across all four steps (same md5).
- **The function.** I extracted `accounting_document_api_requeue_only` from 0383, 0385 and `0385_rollback.sql`.
  - 0385 is 0383's function word for word, plus the one refusal block.
  - The rollback's copy is identical to 0385's.
- **Grants**, from `information_schema` after `db:roles`. `migrate-roles.ts` is not touched by the fixes.
  - `worker_app` has no UPDATE on `payment_group_delivery`, `payload` or the totals.
  - History is append-only for both roles.
- **Role probes** as `api_app` and `worker_app`. The results were the same after the migration, after each rollback and after each forward:
  - Moving to pending is refused (42501, "may not move this parked credit note"), even when unchanged, for a credit note parked as `buyer_default_treatment`, one parked as `credited_invoice_cancelled`, and a `credit_note` parked as `vat_on_delivery`. A bare `updated_at` touch is refused too.
  - A parked delivery **invoice** (`vat_on_delivery`) and a `payment_invoice_cancelled` invoice can still be released.
  - A held credit note cannot be moved by `api_app`.
  - `api_app` cannot insert a `hold` history row.
  - `worker_app` cannot UPDATE history, `payload`, the totals or `payment_group_delivery`.
- **Scratch domain probe** (not pushed). `projectBidRefundReversed` with a reversed refund whose note is `held_for_review` returns no hold, no cancel and no refusal. See N2.

### Verified fixes

- **F1: holds.**
  - The registry re-reads, under the per-(invoice, target) advisory lock and in the registering transaction:
    - the other credit;
    - the payment's `payment_refund` row count;
    - the courier quote's `refunded_pence`.
  - It refuses `credit_prior_changed`, which is in `NOT_YET`, and caps courier notes at min(refunded, charged) (`credit_exceeds_refunded`).
  - Real concurrent transactions credit exactly 3,000 in RV1, and exactly the final total in the stress case.
  - Because `already` excludes the note itself, a replay still matches its basis.
  - The basis passed to registration is lowered by the credit notes cancelled in the same run, so a lowering followed by a rise registers.
- **F2: holds for the order it was built for.**
  - Reversals are routed: `payment.refund_reversed` is written in the same transaction as the reversal on both the webhook and repair paths, and `payment_group.refund_reversed` names the quote.
  - The reversal waits on the same lock key (`creditLockKey`) and then reads the notes, so a registration that read its facts before the reversal is either seen by the reversal or refused by its own row count.
  - The clearing-refund step re-checks `state = 'issued'` under `FOR UPDATE SKIP LOCKED`, so a hold and a clearing refund cannot both proceed unseen. A hold that waits on the step still holds the note and raises the alert.
  - See N1 and N2 for the windows that remain.
- **`hold` life-cycle move: sound.**
  - It goes only from `issued`, and needs a reason.
  - `requeue`, `release` and `cancel` all refuse a held note, because it holds a Books document.
  - It is not listed for clearing refunds or for email.
  - The earlier release already parses this row shape (a provider document with no mismatch), so rollback leaves held rows readable.
- **F3: holds.** See How it was checked.
- **F4: holds.** A stored note is reused as stored (RV2).
- **F5: holds.** The rejected record and the hold are written in one transaction, and the alert is raised.
- **F7: holds.** The `listEmailDue` case is present and passes.
- **F6 deviation (the rollback keeps the refusal): safe, and better than the F6 text.**
  - The earlier release (`629a2250`) never legitimately moves those three kinds: a default's Release refuses while the treatment is unset, and the courier credit note cannot be released. The extra refusal blocks nothing it does.
  - It keeps the rule "never sent while the answer is unset" across a rollback, where dropping it would have opened direct release by `api_app`.
  - One limit (Info): rolling back **0383** after 0385 restores the earlier function without these lines. Name that in the runbook's rollback order.
- **F8: partly holds.**
  - Holds:
    - "Refunded" appears only when refund credit notes that are live, issued and have a stored copy add up to at least the invoice total;
    - a default's note reads "Credit note CN-…" with "Download (PDF)";
    - `paidWith` takes a group's `checkout_rail`, and a lone payment's rail only when its railed sessions all agree. Two rails, or none, gives null.
  - Does not hold: see N3 and N4.

### Findings

#### N1: Medium. A reversal that meets an in-flight credit note can dead-letter, and the note is then refunded from clearing anyway

- **Where:**
  - `packages/accounting-domain/src/projection/bid-refunds.ts:333` (and `:284` for the courier lowering);
  - `packages/persistence/src/repositories/accounting/drizzle-accounting-credit-note-refunds.ts:76-86`;
  - `apps/worker/src/projectors/lib/domain-event-delivery-runner.ts:35`.
- **Scenario:** a refund's credit note is `sending`, `unknown`, or `needs_review` with a lookup owed (a Books timeout, say) when the refund is reported failed.
  - The reversal is refused as `credit_in_flight` and retried.
  - Retries are capped at 12, with full-jitter backoff capped at 15 minutes: about 16 minutes on average. After that the delivery is dead-lettered. The only signal is the generic dead letter; no accounting alert or Accounting page row.
  - When the note later settles to `issued`, nothing re-decides it. `listDue` picks it up, and Books records a refund from Stripe clearing for money the buyer never received.
  - The same happens to a courier lowering that meets an in-flight note.
- **Fix:** make the clearing-refund step re-check the refund itself under its row lock, as a backstop.
  - For a payment refund's note (`LAX-BID-CN-<refund id>`): no `refund_reversal` row matches that refund.
  - For a courier note: the quote's credit is still within `refunded_pence`.
  - Otherwise, hold the note as `refund_reversed_after_credit` and raise the alert, instead of refunding.
  - Optionally, also stop `credit_in_flight` from using up delivery attempts while the note is merely unsettled.
  - Add an integration case: the note is `unknown` when the reversal arrives, the delivery is dead-lettered, the note is then issued, and it is held, never refunded.

#### N2: Low. A reversed refund whose credit note is already held for another reason gets no reversal signal

- **Where:**
  - `packages/accounting-domain/src/projection/bid-refunds.ts:325` (`held_for_review`: break);
  - `apps/worker/src/finance/accounting/accounting-projection.service.ts` `holdIssued` (it skips a note held with the same reason, and throws `credit_in_flight` for any other held note).
- **Scenario:**
  - Books refuses the clearing refund. F5 holds the note as `accounting_credit_note_refund_refused`, and the runbook and the page tell a person to refund it by hand in Books.
  - The Stripe refund then fails. The reversal sees `held_for_review` and does nothing: it projects with no alert, and the note's reason still says "refund by hand".
  - A person following the page books a refund in Books that never happened.
  - The same applies to a note held for a totals mismatch.
- **Fix:** when a reversed refund's note is already held, raise `accounting_refund_reversed_after_credit` anyway. Also re-mark the held reason, so the Needs a person row says the refund was taken back and must not be refunded by hand: allow `hold` from a held note to change its reason, with history. Add a case that goes refused, then reversed.

#### N3: Low. A refund Books refused to clear disappears from the buyer's card, permanently

- **Where:**
  - `apps/api/src/services/organisation-buying/purchase-invoice-books.service.ts:37` (servable means `status === "issued"`);
  - `apps/web/src/lib/purchases/purchase-invoice-card.vm.ts` (`refundedInFull`).
- **Scenario:**
  - The buyer **was** refunded by Stripe, but Books refused the clearing refund (F5). The note is held.
  - The buyer's "Refunded −£x to your card" row and its credit-note PDF vanish. A purchase refunded in full goes back to "Paid / Total paid".
  - No move leaves the held state, so this lasts until someone edits the row by hand.
  - (For N2's reversal hold, hiding the row is correct.)
- **Fix:** keep serving a held credit note that holds a Books document and has a stored live copy when its reason is `credit_note_refund_refused`. That refusal is between LAX and Books, and the buyer's refund stands. Add a vm and api case.

#### N4: Low. "to your bank account" may still be a guess about where the refund goes

- **Where:**
  - `apps/web/src/lib/purchases/purchase-invoice-card.vm.ts:68`;
  - `packages/persistence/src/repositories/accounting/drizzle-bid-invoice-books.reader.ts:145`;
  - `apps/api/src/services/stripe/stripe-payment-gateway.ts:144`.
- **Scenario:**
  - `paidWith` reports the **payment** rail, not the refund's destination.
  - A bank-transfer Bid payment is a Stripe `customer_balance` payment. `createRefund` sends only the charge and amount, with no destination.
  - I could not confirm from the code where Stripe returns such a refund by default. If it goes to the buyer's Stripe cash balance, it does not reach their bank account, and the copy states a destination LAX never chose.
  - The card rail is fine.
- **Fix:**
  - Confirm the destination in test mode (or from the refund object's own destination fields) and pin it with a test.
  - Until then, show "Refunded −£x" with no destination for `bank_transfer`.

#### N5: Low. A held credit note blocks the payment's later refunds, and "waits" really means "dead-letters"

- **Where:**
  - `packages/persistence/src/repositories/accounting/drizzle-accounting-document.registry.ts:229` (a held note counts in `already`);
  - the NOT_YET path (`credit_exceeds_invoice`).
- **Scenario:**
  - A £100 payment: refund A of £60 is issued, then reversed, so its note is held.
  - The full £100 is then refunded for real. Note B is refused `credit_exceeds_invoice`, retried, and dead-lettered after about 12 attempts.
  - The buyer got £100, there is no credit note, and nothing is refunded from clearing.
  - The "Still open" note says the later refund "waits until a person settles it". But no in-app action settles a held note: `release`, `requeue` and `cancel` all refuse it. And the wait ends in a dead letter.
- **Fix:**
  - Give the person a defined way out: an Accounting action "settled in Books" that cancels the local held row with history, kept to the reversal reasons.
  - Have the runbook say to redrive the dead-lettered `payment.refunded` delivery afterwards.
  - Alternatively, exclude notes held as `refund_reversed_after_credit` from the gross cap.

#### N6: Info

- **`paidWith` and old data.** Rail-null sessions (opened before rails were recorded) are ignored. A payment completed through such a session, with a railed session left abandoned, reads as the abandoned rail. This affects old data only.
- **Lost alert.** If the worker stops after a hold but before its alert, the replay skips the note, so no alert is sent. The Needs a person row still shows it.

### Verdict: FIX FIRST

F1–F8 are fixed as described, with the exceptions in N1–N5, and the fixes added no regressions in grants, migration or rollback. The `hold` move is sound. The F6 deviation is safe.

- **N1 must be fixed before shipping.** It is the money gap F2 was meant to close, now narrowed to a reversal that meets an in-flight credit note (about 16 minutes of retries). A small re-check in the clearing-refund step closes it.
- **N2–N5** are Low. They can land with N1 or be tracked, but N2 and N3 should not ship as they are, because each tells a person or a buyer the wrong thing about money.

Books stays dry run and test organisation only, and the owner's hard rules still hold.

## Fixes after recheck

Fixed on `bk9-bid-refunds`, head `aea57b45` (base `3c911293`; main had not moved, so no merge was needed). The branch had one new commit, `f95b9285` (the refunds suite runs its api_app checks as api_app in CI). The two fix commits were placed on top of it. Re-checked on a throwaway Postgres 16 (initdb under `/var/tmp`, port 55432) with `db:migrate` and `db:roles`. Integration suites ran as `worker_app` and `api_app`. The refunds suite was also run with neither role URL set, as CI runs it (29 passed). Each mutation reverted one guard, rebuilt the package the worker reads, ran the tests and restored the guard. `git status` was clean afterwards.

Migration 0385 is unchanged: no CHECK or function had to change, because the history CHECK already allows `hold` and the api_app function does not look at held rows. So `FINAL_FOLDER_MILLIS` stays `1811419200000`.

| # | Fix | Commit | Test | Mutation |
|---|---|---|---|---|
| N1 | The clearing-refund step (`settleExclusively`) reads the refund again under the credit note's `FOR UPDATE` lock, before the Books call. **Payment refund note:** the payment's `payment_refund` rows are matched as the facts reader matches them (`withoutReversed`), and the note's refund must still be kept. **Courier note** (`dlv-<quote>-r<total>`): `<total>` must be within the quote's `refunded_pence`. A source it cannot tell is treated as not standing. Otherwise the note is held as `accounting_refund_reversed_after_credit` in the same transaction, the step answers `refund_reversed`, the service raises `accounting_refund_reversed_after_credit`, and nothing is refunded or recorded as `refund_credit_note`. **Delivery attempts:** `credit_in_flight` is now a *waiting* not-yet. It is retried every 5 minutes, the attempt increment is undone, and it is never dead-lettered for waiting. Other not-yets still use up attempts. | `d0ba81c1` | Integration: the note is `unknown` when the reversal arrives (refused `credit_in_flight`, `waiting`), the delivery is treated as dead-lettered, and the lookup then issues the note. The step holds it, raises the alert once, refunds nothing and writes no `refund_credit_note`; a later refund that stayed is still refunded. Courier: two issued notes, total lowered 3,000 → 1,500 with no event, so the 1,000 note is refunded and the 2,000 note is held with the alert. Persistence: a reversed refund and an unknown source each answer `refund_reversed`, the step is never run, and they are not listed again. Runner unit: a waiting error at the attempt cap is retried at least 5 minutes later with the increment undone; `credit_exceeds_invoice` at the cap is dead-lettered. | Payment re-check removed: killed (N1 integration). Courier comparison removed: killed (courier case). Waiting flag removed from the runner: killed (runner unit). |
| N2 | `projectBidRefundReversed` and the courier lowering hold a `held_for_review` note as `refund_reversed_after_credit` too. The domain `hold` move now also goes from a held note (`needs_review`, lookup clear, Books document kept) to a new reason. The same reason is refused. A parked note or one owing a lookup is never held. `holdIssued` re-holds such a note and raises the alert with `heldBefore`. The history row (`needs_review` → `needs_review`) keeps `heldBefore`. | `d0ba81c1` | Integration: refused, then reversed. The reason becomes `accounting_refund_reversed_after_credit`, the alert is raised once with `heldBefore: accounting_credit_note_refund_refused`, and both `hold` rows are in history. A replay does nothing. Domain: both policies, and `hold` from held (new reason ok; same reason, parked, or owed refused). | Projection back to `break`: killed (N2 integration and domain). `holdIssued` re-hold guard removed: killed (N2 integration). |
| N3 | The API lists and serves a refund's credit note held as `accounting_credit_note_refund_refused` when it holds a Books document and LAX's stored live copy (not a rehearsal). It keeps its number and issue date. The buyer-card reader keeps `issuedAt` for a held note with a Books document. A note held for any other reason (reversed, totals) is still never shown. | `d0ba81c1` (reader), `aea57b45` (API) | API: refused is listed and served (`credit-note-CN-00007.pdf`). Reversed and totals mismatch are not listed and give a 404. No copy means not listed. vm: a full refund through that note still reads "Refunded". Integration (F5): the reader returns the held note with `issuedAt`. | — |
| N4 | `bank_transfer` reads "Refunded −£x" with no destination; card keeps "to your card". | `aea57b45` | vm: card, bank transfer and unknown, pinned. | — |
| N5 | The registry's gross cap (`credit_exceeds_invoice`) leaves out notes held as `accounting_refund_reversed_after_credit`. The basis checks still read every non-cancelled note, as the flows do. Runbook: redrive a dead-lettered `payment.refunded` delivery once the blocking note is held with that reason. | `d0ba81c1` | Integration: paid P (12,500), P×0.6 reversed after issue (held), then P refunded for real. The P note is created, sent, and refunded from clearing in full; the held note is never refunded. | Exclusion removed: killed (refused `credit_exceeds_invoice`). |
| N6 | Runbook rollback order: roll back 0385 before 0383, and stop there if possible. Rolling back 0383 after 0385 restores the function without the 0385 refusal: re-apply 0385 straight after, and do not press Release on a parked credit note until it is back. | `d0ba81c1` | — | — |

**Runs on the head:**

| Area | Result |
|---|---|
| accounting-domain | 318 passed |
| accounting-zoho-books | 318 passed |
| persistence accounting and lib | 206 passed (the credit-note suite's fixture now has a real `payment_refund` row behind its credit note) |
| db: `api-app-role.contract`, `migration-0385`, `migration-main-upgrade` (with `MIGRATION_TEST_DATABASE_URL`) | 51 passed |
| worker `src/finance` and `src/projectors` (unit and integration) | 374 passed. `bid-refunds-books` alone: 29 passed, both with role URLs and as CI runs it. |
| worker unit (all, integration files excluded) | 1,583 passed, 2 failed: `drizzle-email-outbox.repository.test.ts` needs the identity database's `email_outbox` table, which this throwaway setup does not create. The fixes do not touch it. |
| api organisation buying and its routes | 293 passed |
| web purchases | 79 passed |

**Migration.** `db:migrate` gave 377 rows, last `1811419200000`. `0385_rollback.sql` then forward (`db:migrate`, `db:roles`) **twice**:

- The ledger went 377 → 376 → 377 each time.
- The CHECK came back `NOT VALID` after rollback and validated after forward.
- The function md5 was the same at every step.
- The data was unchanged: 128 `hold` or `refund_credit_note` history rows, of which 7 re-hold a held note (`needs_review` → `needs_review`); 42 notes held as reversed; 11 held as refused; the parked rows.

**Still open:**

- A cancelled courier step's reference stays taken, as before.
- No in-app action settles a held credit note. A person settles it in Books as the runbook says. A note held as reversed no longer blocks later refunds, but one held for another reason still counts against the invoice.
- A bank-transfer refund's destination is not confirmed in Stripe test mode, so the card names none.
- Accountant questions: defaults, VAT on delivery, reversing an issued credit note, and the bank-transfer refund mode.
