# Review: PR #1359 — Zoho Books: payments (rehearsal)

Independent money and security review of branch `bk8-books-payments` at `5c0ec376` (Zoho Books plan v2, PR 8; migration 0382). Main was at `a8ce61af` when reviewed, and the branch is based on it. The PR #1356 review notes were read for context.

## How it was checked

- `corepack enable && pnpm install --frozen-lockfile && pnpm -r --filter './packages/**' build`: ok.
- A throwaway Postgres 16.15 cluster (initdb under `/var/tmp`, port 55432). `db:migrate` (374 migrations) and `db:roles` ran on a fresh database.
- Migration pair 0382: rollback, forward, rollback, forward on a copy of the migrated database (parked rows present). All four steps ran cleanly.
- Tests, in small batches with `--maxWorkers=2`, against the real database. The integration suites ran; none were skipped (apart from the db migration-lineage suites, which need `MIGRATION_TEST_DATABASE_URL`).

  | Area | Result |
  |---|---|
  | accounting-domain | 245 passed |
  | accounting-zoho-books | 290 passed |
  | types | 326 passed |
  | finance-runtime (books) | 25 passed |
  | persistence (accounting) | 65 passed |
  | persistence (payment group) | 25 passed |
  | db (roles, role contracts) | 169 passed, 31 skipped (lineage suites) |
  | worker (accounting, projectors) | 273 passed, **1 failed** (flaky; see F3) |
  | api (payment group, Stripe webhooks, accounting) | 230 passed |
  | web (Accounting) | 51 passed |

- `pnpm lint:layers`: ok, no layering violations. `biome check` on the 62 changed files: clean. Typecheck: worker, api, persistence and finance-runtime are clean. Web has one error, `@auction/api/app` not found, because the API app was not built in this checkout; it is not from this PR.
- Grants, checked with `has_table_privilege` after `db:roles`:
  - `worker_app` has SELECT only on `payment_group` and `payment_group_delivery`.
  - `api_app` is unchanged.
  - `shop_app` and `auth_app` have nothing on `payment_group`, `payment_group_delivery`, `accounting_document` or `payment`.
- New tests on real transactions: `tests/review1359.integration.test.ts` on this branch. It is meant to sit next to `bid-payments-books.integration.test.ts` and was not pushed to the PR. All 6 pass, 3 runs in a row.
  1. **R1:** six senders tick at the same moment, four rounds, against a three-invoice Pay several. No document is posted twice. When the payment posts, every invoice was posted before it, and it was posted with `attempts` 1. In about 3 runs out of 5, an invoice fails instead and the payment stays `pending` with 0 attempts (see F2).
  2. **R2:** a group member's own `payment.captured` is skipped (`payment_in_group`). No second payment document exists.
  3. **R3:** the stored group total is moved 1p over, then 1p under, its rows. Both are refused (`allocation_mismatch`) and no payment row is stored.
  4. **R4:** an invoice of another account in the group is refused (`buyer_mismatch`).
  5. **R5:** a payment row added to the group after the event is refused with `retryable = false`.
  6. **R6:** the runbook's recovery for parked documents does not work (see F1).
- Mutation tests. Each mutation was applied, the package rebuilt where needed, the tests run, and the file restored. `git status` was clean after every run.

  | # | Guard reverted | Result |
  |---|---|---|
  | M1 | Allocations must equal the payment (`checkExactAllocations`) | killed (4 domain tests, R3) |
  | M3 | Payment ordering (`AWAITED_INVOICES_ISSUED` dropped from the claim) | killed (PR's Pay several integration test, R1) |
  | M4 | The delivery invoice is no longer parked (`DELIVERY_BOOKING === null` branch) | killed (1 domain test, 2 integration tests) |
  | M5 | The registry ignores `park` and stores the document `pending` | killed (2 integration tests) |
  | M6 | The check that the event's ids match the stored rows (`sameIds`) | killed (1 unit test) |
  | M7 | Dry-run and test_org destination gate (`wrongDestination` always passes) | killed (7 tests) |
  | M8 | A member paid more than its invoice (`payment_exceeds_invoice`) | killed (2 domain tests only; no integration test) |
  | M9 | Another account's invoice (`buyer_mismatch`) | killed (1 domain test, R4) |

- UI: the screenshots on `review-notes-pr1359` `shots/round1/` were judged: needs-person, the Pay several details, the delivery details and the waiting details, each in 1440 light and dark and at 375 light.

## What meets the owner's rules

- **Dry run.**
  - Nothing new can reach a Books organisation. The destination gate bound to the organisation id (`checkDestination`) is unchanged and still kills M7.
  - The PR's dry-run integration test asserts `fetch` is never called.
  - Buyers see nothing new: no buyer route, email or card changed, and the #1356 standing and email rules are untouched.
- **No VAT on delivery.**
  - `DELIVERY_BOOKING` is `null`.
  - Every delivery invoice is built as a draft (`outside_scope`, carrying exactly the quote's stored charge) and stored straight into `needs_review` with `accounting_parked_vat_on_delivery`, never `pending` first. The Pay several payment that includes it is parked with it.
  - A parked document cannot be requeued: the domain refuses (`parked`), and so does the api_app trigger (0382). It is excluded from the claim because it is not `pending`.
  - M4 and M5 are killed.
- **Amounts only from stored rows.**
  - The event is references only (group, account, payment ids, quote ids and the time). It is classified `piiClassification: none` and passes the PII allowlist.
  - The reader takes the group total, each member's `payment.amount` and each quote's `payment_group_delivery.amount`, converted to pence in SQL (`(amount * 100)::bigint`, exact).
  - Nothing is recomputed, split or rounded.
- **Allocations equal the payment exactly.**
  - `checkExactAllocations` requires positive whole pence, no duplicate invoice, and a sum exactly equal to the payment. A penny either way is refused, and the refusal stores nothing (R3).
  - Many lots work: 3 × £33.33/£33.33/£33.34 = £100.00 in the PR's test.
  - Refused: a member paying more than its invoice, another account's invoice (R4), and a currency other than GBP.
- **Outbox.**
  - `payment_group.settled` is published with `withTx(tx)` inside the settlement transaction, after the captures and the `paid` transition. The PR's test shows a rolled-back settlement leaves no event.
  - The projector refuses without retrying when the stored rows differ from the event's ids (R5, M6).
- **Idempotent by LAX reference.** Six concurrent projections of one group give one payment (the PR's test). Replays are recognised.
- **No double posting.** A group member's own `payment.captured` is skipped (R2). A released group clears `payment_group_id`, so a later individual payment is booked normally.
- **Ordering.**
  - A payment is claimable only once every invoice it is applied to is `issued` for the same product, entity, provider and mode. The check is in the claim's own statement, under `FOR UPDATE SKIP LOCKED`.
  - It waits with 0 attempts and does not block the documents behind it.
  - Under concurrent senders it is posted once and after its invoices (R1). The existing lease and lookup-before-retry path is unchanged.
- **Flows 2–7.**
  - Card (flow 2) and a fully funded transfer (flow 5) go through `payment.captured`.
  - A part-funded transfer (flow 6) makes no document; it is listed on the page.
  - Unapplied or misapplied money (flow 7) has no route and stays a finance task.
  - A payment for a cancelled invoice is parked, and the cancelled invoice is not booked again.
- **Refunds.** Nothing is half-implemented. No refund flow, route or copy was added. Group members' refunds are still skipped by the existing `payment_in_group` rule.
- **Accounting page.**
  - Staff only: the existing `/finance/*` `finance.read` gate applies.
  - Try again needs the finance write capability and an Idempotency-Key.
  - The web fetch is `no-store` and the page is dynamic.
- **Migration.** 0382 is next after main's 0381 and is in the journal.
- **Architecture.**
  - The policies are pure domain code (`bid-payments.ts`, `allocation.ts`, `parking.ts`, `dependencies.ts`).
  - The readers and registry are in persistence, and the routes are in the worker.
  - `lint:layers` is clean.

## Findings

### F1 — Medium — Parked documents have no way out: the runbook's recovery cannot work

The runbook, the domain comment on `DELIVERY_BOOKING` and the PR body all say that once the accountant answers: "set the booking, cancel the parked drafts, and project the group's event again". The cancelled-invoice copy also tells staff to "reinstate the invoice". Neither path can book the payment:

- **No tool to re-project.** Nothing in the codebase re-projects a past event. The projector's cursor only moves forward.
- **The cancelled row still holds the reference.** Even if the event is projected again:
  - When the payload is unchanged (an invoice reinstated), the registry treats it as a replay, returns the cancelled row and reports success. The payment stays cancelled. R6 shows this.
  - Once `DELIVERY_BOOKING` is set, the delivery invoice's treatment changes. The payload then differs, so the registry refuses with `reference_in_use` and the event goes to failed deliveries.
- **Parked rows can only be cancelled.** `requeue` refuses them, and nothing ever releases them.

So every Pay several payment that included a courier quote (and every payment for a cancelled invoice) can never reach Books. Today that is only a rehearsal gap, but it is a money gap the moment Books is live.

**Fix:** pick one of these and make the runbook and copy match it:
- Add an explicit release transition for parked documents. `needs_review` with a parked reason goes to `pending`, allowed only when the reason is resolved: `DELIVERY_BOOKING` is set and the draft is rebuilt, or the invoice is no longer voided. It needs its own audit and trigger clause.
- Or keep cancel, then re-project, but give the new documents a versioned source id (for example `dlv-<quote>-2` and `grp-<group>-2`), and add an ops command that re-projects one event id.

Add an integration test that runs the documented recovery end to end.

### F2 — Medium — The order is enforced for payment→invoice, but not for invoice→contact; with concurrent senders an invoice fails and its payment waits for a person

The claim orders by `created_at, id`. The documents of one projection are registered with `clock.now()` one after another, so two can share a millisecond. Ties are then broken by a random uuid, and several senders run at once. In either case an invoice can be claimed before its contact is issued. Books then refuses it with `zoho_books_contact_missing`, the invoice goes to `failed`, and that needs a person to press Try again.

This PR makes the effect wider: the payment now waits for that invoice, so a payment is held too, with nothing on the page saying why.

- **Reproduced:** R1 (six concurrent senders) ends this way in about 3 runs out of 5.
- **Single sender:** the same happens when the contact and the invoice share a `created_at`. That is the cause of F3.

**Fix:** extend `documentsAwaited` (and `AWAITED_INVOICES_ISSUED`) so that an invoice or credit note also waits for its `contactReference` to be `issued` for the same target. It is the same SQL shape. Add R1 with a strict assertion: the payment is issued once, after every invoice, every time.

### F3 — Low — An existing sender integration test is now flaky (about 40%)

`accounting-sender.integration.test.ts` › "keeps a payment Books read back different, answered after its lease, with a person and never resends it" failed 2 times in 5 single-test runs, and once in the full batch.

- **Cause:** the test queues contact, invoice and payment in one instant.
- **When the invoice sorts first:** it fails with `contact_missing`, so (with this PR's ordering) the payment is never claimed and stays `pending`.
- **Before this PR:** the payment was claimed regardless, so the test passed.

**Fix:** F2 fixes the cause. In the meantime, queue the documents one at a time with distinct times, as the test's sibling `differingPaymentWhoseAnswerIsLost` already does.

### F4 — Low — A waiting payment can wait forever, silently

A payment is only claimable once its invoices are `issued`. If an awaited invoice is in `failed`, `needs_review` (for example a totals mismatch), or `cancelled` by staff in Accounting while the Bid invoice is not voided, the payment sits in **Waiting** with no reason and no alert. Every waiting payment shows the same line, "Sent once each invoice it pays is in Books.".

**Fix:**
- Show which invoice it is waiting for, and that invoice's state, in the row and in the details.
- Raise the existing delayed-accounting alert when a payment has waited longer than N hours.
- Treat a `cancelled` awaited invoice as a reason to park the payment (`invoice_cancelled`) instead of waiting.

### F5 — Low — The details sheet says "Last problem: Books gave no reason." for a payment that was never tried

`waiting-paysev-details-375-light.png` shows a queued Pay several payment with 0 attempts under a "Last problem" notice saying "Books gave no reason.". The sheet falls back to `ACCOUNTING_NO_REASON_TEXT` for any row without a problem that is not "In Books". This PR's waiting payments make that the common case, and the text is misleading: Books was never asked.

The parked notice also repeats itself. The title is "Waiting for the accountant" and the body starts "Waiting for the accountant: VAT on delivery…".

**Fix:**
- Show no notice (or the ordering note as an info notice) when `attempts` is 0 and the state is `pending`.
- For parked rows, either drop the title or drop the prefix from the body.

### F6 — Low — Rolling back 0382 lets the earlier release try a parked delivery draft again

The rollback restores 0379's trigger, which allows api_app to requeue any `needs_review` row that is clear and has no provider. That includes parked rows. The earlier release's domain does not know about `parked`, so its `requeue` would allow it too.

**Failure:** after a rollback, a Try again on a parked delivery invoice would queue a draft booked `outside_scope`, which is exactly what the owner rule forbids. Today only dry run is affected.

**Fix:** in `0382_rollback.sql`, before restoring the old trigger, move parked rows to `cancelled` with an audit event (or keep the parked clause in the restored function). Say so in the rollback's header.

### F7 — Low — The API's accounting page response has no `Cache-Control: no-store` and now carries account names

`GET /admin/finance/accounting` sets no cache header. It now returns `partFundedTransfers[].buyer`: the account's legal or display name, which for an individual buyer is a person's name.

The web side fetches it with `no-store` and renders a dynamic page, so the exposure is limited to intermediaries between the web server and the API. It is still inconsistent with the #1356 F6 fix on the buyer routes.

**Fix:** add the same `noStore` middleware to the `/finance/accounting` routes, and add a route test asserting the header on 200, 403 and 400.

### F8 — Info — The new copy is not in the repository's exact-copy table

The PR says the plan's exact-copy table is not in the repository, and lists the new strings for the owner to confirm. The wording is consistent with the approved style.

One string conflicts with F1: "Refund the buyer or reinstate the invoice" offers a reinstatement path that cannot currently book the payment. Confirm all of them with the owner, and reword that string if F1 is not fixed in this PR.

### F9 — Info — Test coverage notes

- Adopt R1 to R6:
  - R1 strict once F2 is fixed;
  - R6 inverted once F1 is fixed;
  - R3 adds the 1p over and under case at integration level, which the PR only covers in the domain (M1).
- `payment_exceeds_invoice` (M8) is only covered in the domain. Add a stored-row case where a member's `payment.amount` is above its invoice total.
- The event's `settledAt` comes from `new Date()`, not the injected clock. The projector correctly uses `payment_group.settled_at` instead, so this is cosmetic, but a test asserting the two agree would catch drift.

### F10 — Info — UI from the screenshots

- **Clean:** no horizontal scroll at 375px, and long references wrap. Dark mode follows the tokens. The "Applied to" amounts add up to the payment (£1,543.20 + £333.33 + £45.01 = £1,921.54).
- **Status column at 1440:** the "Waiting for the accountant" badge sits flush against the "Last problem" text, with no gap. Add a few pixels of column padding.
- **Part-received panel:** it uses link-blue text for content that is not a link. Consider the muted text token for the details.
- **Missing state:** there is no screenshot of the panel when it is empty (hidden?) or of a failed invoice holding a payment. Add both.

## Severity table

| # | Severity | Area | Summary |
|---|---|---|---|
| F1 | Medium | Money / ops | Parked documents can never be booked: no re-project tool, and the cancelled row keeps the reference; the runbook recovery and the "reinstate" copy do not work |
| F2 | Medium | Ordering | Invoice→contact is not ordered; with concurrent senders, or equal `created_at`, an invoice fails `contact_missing` and its payment waits for a person |
| F3 | Low | Tests | The existing sender integration test is now flaky (about 40%) |
| F4 | Low | Ops / UI | A waiting payment can wait forever, with no reason shown and no alert |
| F5 | Low | UI | "Books gave no reason." on a never-tried waiting payment; the parked notice repeats its title |
| F6 | Low | DB / rules | The 0382 rollback re-allows requeueing a parked delivery draft |
| F7 | Low | Security | API accounting response lacks `no-store` and now carries account names |
| F8 | Info | Copy | New strings need owner confirmation; "reinstate the invoice" conflicts with F1 |
| F9 | Info | Tests | Adopt R1–R6; integration cases for 1p mismatch and member overpaying |
| F10 | Info | UI | Badge spacing, link-coloured non-links, two states not shot |

All the owner's hard rules hold: dry run only, delivery parked and never sent, amounts from stored rows, exact allocations, idempotent, and no production change. F2 and F3 make the PR's own CI flaky and are a small fix. F1 leaves the documented recovery path broken. Fix both, or correct the runbook and copy for F1, before merge.

### Verdict: FIX FIRST

## Fixes after review

The fixes are on `bk8-books-payments`, merged with `origin/main` at `f5670a31` (merge `d479f62e`). Migration 0382 is still the next free number. Every check below was re-run on that head: Postgres 16.15, port 55432, `db:migrate` and `db:roles`, tests with `--maxWorkers=2`.

| # | Fix | Commit | Test evidence | Mutation |
|---|---|---|---|---|
| F1 | **Release.** A parked `needs_review` document goes to `pending` (`release` in the life cycle). The API projects the stored Bid rows again with the policy that parked it (`resolveParked`) and releases the document only if they no longer park it: `DELIVERY_BOOKING` is set and the delivery draft is rebuilt under the same reference and gross, or the invoice is no longer voided. Otherwise it is refused with the reason. It has its own history action (`release`, who asked), audit event (`accounting_document.release_requested`) and 0382 trigger clause, and a permission-gated **Release** on the Accounting row, menu and details. The runbook, domain notes and copy describe exactly this recovery. | `512f3f4d` | `release.test.ts` (domain); `accounting-queue.release.test.ts` (runtime); api_app role contract (release clause probes); R6, inverted: the recovery end to end as api_app (refused while unresolved, then delivery rebuilt and payment released, both issued in order); R6b: a reinstated invoice's payment | **Killed** (`still parked` check removed): 2 domain, 1 runtime, 2 integration tests |
| F2 | `documentsAwaited` and the claim SQL (`AWAITED_ISSUED`): an invoice or credit note also waits for its contact to be issued for the same target. R1 adopted as strict. | `af07585c` | Persistence: "an invoice is not claimed before its contact is issued, even at the same instant and older". Strict R1 (the payment is posted once, after every invoice, on its first attempt): 5/5 green. | **Killed** (contact branch removed): the persistence test every run; strict R1 in 4 of 5 runs |
| F3 | The sender read-back test queues documents one at a time, at distinct times. F2 removes the cause. The same change, also on the remote branch (`fb0eb3ce`), was merged and the conflict resolved. | `6d492ca9` | 10/10 single-test runs green | n/a |
| F4 | The row and details name each document a waiting payment waits for, and its state (or "Not queued yet"). The existing delayed-accounting alert (`accounting_bid_invoice_delayed`, `documentType: "payment"`) is raised after 6 hours of waiting. The sender-missed check no longer counts waiting documents. A cancelled awaited invoice parks the payment as `invoice_cancelled` (`parkStranded`, history action `park`). | `4c5055d8` | Persistence: `parkStranded`, `waitingPayments`, `awaitedOf`. Watch unit test (6 h). Web row and details. R8 (integration). | **Killed** (park condition made false): the persistence test and R8 |
| F5 | No "Last problem" for a document with 0 attempts that is `pending`. The order note shows as an info notice, "Not sent yet". The parked notice keeps its title, and its body no longer repeats "Waiting for the accountant". | `5744678a` | Web tests: a never-tried payment; the parked notice title. Screenshots `waiting-queued-details`, `needs-person-delivery-details`. | n/a |
| F6 | The `0382_rollback.sql` header says what it does. Parked rows move to `cancelled`, each with a `cancel` history row (`{"rollback":"0382","parked":…}`), before the old trigger is restored. The rollback also revokes the release columns. | `78132574` | Rollback, forward, rollback, forward on a copy with 38 parked rows: all 38 cancelled with history, 0 left parked | n/a |
| F7 | `noStore` on `/finance/accounting` and `/finance/accounting/*`, mounted before the finance gate | `a354aa6a` | Route tests: 200, 400 and 403 (gate and write guard) all carry `no-store` | **Killed** (registration removed): 2 route tests |
| F8 | The cancelled-invoice copy now reads "…Refund the buyer, or reinstate the invoice in Bid and press Release." Every new staff-facing string is listed under "New copy" in the PR body. | `5744678a` | `admin-accounting.test.ts` asserts both texts name Release | n/a |
| F9 | R1–R6 adopted (`bid-payments-books-guards.integration.test.ts`): R1 strict, R6 inverted, R3 the 1p over/under at integration level. Added R7, a member's stored payment above its invoice (`payment_exceeds_invoice`). Settlement takes `settledAt` from an injected clock and writes the same instant to `settled_at`; the integration test asserts they agree. | `f974d9e3` (and `512f3f4d` for R1–R6) | guards file 9/9, 3 full runs; payment-group integration | n/a |
| F10 | Padding after the status badge (column 188px). The muted text token for the part-received details. Screenshots of the empty panel state and of a failed invoice holding a payment. The list's cells moved to their own file to stay under the 550-line guardrail. | `725d8fac`, `112a3bf2` | `review-notes-pr1359` `shots/round2/` (30 shots, no horizontal scroll) | n/a |

Other results on the merged head:

- **Lint and typecheck.** `lint:layers`, `lint:deps`, `lint:seller-commission`, `lint:web-guardrails`, `lint:staff-list-template` and `lint:admin-capability-drift` pass. biome is clean on the 87 changed files. Typecheck is clean for types, accounting-domain, persistence, finance-runtime, db, api, worker and web. The web check is clean once the API is built.
- **Tests:**

  | Package | Result |
  |---|---|
  | accounting-domain | 255 passed |
  | accounting-zoho-books | 290 passed |
  | types | 326 passed |
  | finance-runtime | 228 passed |
  | persistence (accounting, payment group) | 93 passed |
  | db (roles, contracts) | 118 passed |
  | worker (accounting, projectors) | 284 passed |
  | api (payment group, Stripe webhooks, accounting, failed jobs) | 487 passed |
  | web (Accounting) | 507 passed |

- **Residual.** The database holds a release to its shape: parked to pending, document unchanged except a delivery draft rebuilt with the same reference and gross. Whether the reason is settled is the application's decision from the stored rows, because at row level a requeue and a release of a parked row look the same.

## Recheck

Independent recheck of the fixes on `bk8-books-payments` at `d479f62e` (merge of `origin/main` at `f5670a31`). `origin/main` is now at `bec48024`; its last migration is still 0381, so 0382 is still the next free number and is the last entry in the branch's journal. Each claimed fix was checked against the code, not the table.

### How it was checked

- `corepack enable && pnpm install --frozen-lockfile && pnpm -r --filter './packages/**' build`: ok.
- Throwaway Postgres 16.15 (initdb under `/var/tmp`, port 55432). `db:migrate` (374 migrations) and `db:roles` on a fresh database; tests ran with the owner, `api_app` and `worker_app` URLs set, so the 0382 triggers were exercised as `api_app`.
- Tests in small batches, `--maxWorkers=2`. Nothing failed.

  | Area | Result |
  |---|---|
  | accounting-domain | 255 passed |
  | accounting-zoho-books | 290 passed |
  | types | 326 passed |
  | finance-runtime | 228 passed |
  | persistence (accounting, payment group) | 93 passed |
  | db (api_app and worker_app role contracts, roles) | 118 passed |
  | worker (accounting, projectors; incl. the 5 recheck cases below) | 289 passed |
  | api (accounting routes, payment group, failed jobs, accounting audit) | 201 passed |
  | web (Accounting components, view model, actions) | 330 passed |

  Strict R1 (six concurrent senders) passed 5 more times in a row; the sender integration suite (F3) passed.
- Recheck cases on real concurrent transactions, in a scratch file next to the guards suite (not pushed; same fixtures):
  - **RC1** two staff release the same parked delivery invoice at the same moment, on separate `api_app` connections: one `released`, one `already_queued`; one `release` history row, one audit event, gross unchanged.
  - **RC2** a release while another transaction holds the parked row's lock and cancels it: the release waits, then is refused (`not_allowed`); no history, no audit.
  - **RC3** a payment parked `invoice_cancelled`, the Bid invoice reinstated, Release pressed, and the invoice voided again by a concurrent commit after the release has read the rows but before the move: see N1.
  - **RC4** a release while a concurrent transaction cancels the paid invoice in Accounting: the release goes through (it read before the commit), and the next sender tick parks the payment again (`invoice_cancelled`). It is never issued.
  - **RC5** direct updates as `api_app` against the 0382 clause: see N2 and N4.
- Mutation tests. Each was applied, rebuilt where needed, run, and restored; `git status` was clean after each.

  | # | Mutation | Result |
  |---|---|---|
  | MR1 | `resolveParked`: the "still parked" refusal removed | **killed**: 2 domain (`release.test.ts`), 1 runtime (`accounting-queue.release.test.ts`), 2 integration (R6, R6b) |
  | MR2 | API: `requireAccountingQueueWrite` removed from `POST /finance/accounting/:id/release` | **killed**: 2 route tests (permission gate; 403 with no-store) |
  | MR3 | 0382 trigger: the release clause's `NEW.gross_pence = OLD.gross_pence` replaced with `true` (on the live test database) | **killed**: api_app role contract; contract green again once restored |

- Migration 0382 rollback and forward, twice, on a copy of the tested database with 27 parked rows (19 `vat_on_delivery`, 8 `invoice_cancelled`): both cycles ran cleanly. All 27 were cancelled, each with one `cancel` history row (`rollback: 0382`), and none were left parked. After forward and `db:roles`, `api_app` has its release columns again. See N3 for what does not come back.
- Screenshots `review-notes-pr1359` `shots/round2/`: the Release dialog at 1440 light and dark and at 375 light, and the delivery details at 1440 dark and 375 light. The dialog names the LAX reference and says nothing changes if the reason is not settled. At 375 the buttons stack full width with no horizontal scroll. The parked notice has its title once and ends "Then press Release." Dark mode follows the tokens.

### The fixes, as found

- **F1 Release: holds, with N1 to N3.**
  - A parked `needs_review` document goes to `pending` only through `release`.
  - The API projects the stored Bid rows again with the policy that parked it (`resolveParked`). It refuses if the rows still park the document, no longer make it, or make a different document.
  - Only a `vat_on_delivery` invoice may be rebuilt, and then only with the same reference, kind and gross. A payment is not released while an invoice it pays is cancelled in Accounting.
  - The documented recovery runs end to end (R6, R6b): refused while unresolved, then issued in order with `attempts` 1.
  - Release is gated server-side by `requireAccountingQueueWrite` plus an Idempotency-Key (MR2), not only hidden in the UI (`canRelease` follows `canAct`).
  - It writes a `release` history row (`requestedBy`, `parked`, `rebuilt`) and an `accounting_document.release_requested` audit event. The event is in the catalogue and the PII allowlist and has a web label.
  - The 0382 clause allows `api_app` only parked `needs_review` (clear, no provider id) → `pending`. The document is unchanged, except a parked delivery invoice rebuilt under the same LAX reference and gross. Requeue of a parked row is refused, and so are a moved gross, a changed payment payload, a changed `lax_reference`, a `release` history row without `requestedBy`, and a `park` history row from `api_app` (RC5).
  - Concurrent double release and release-vs-cancel serialise on the row lock (RC1, RC2).
- **F2: holds.**
  - The claim's own statement requires everything awaited to be `issued`: a payment's invoices, and an invoice's or credit note's contact (`AWAITED_ISSUED`), under `FOR UPDATE SKIP LOCKED`.
  - At read committed, a sender only sees a contact once its `issued` is committed, so an invoice cannot overtake its contact under concurrency.
  - Strict R1 passed 6/6 here.
- **F3: holds.** The sender read-back test queues at distinct times, and the suite is green.
- **F4: holds.**
  - A cancelled awaited invoice parks the payment (`parkStranded`, every tick, `SKIP LOCKED`, history `park`). RC4 shows this also catches a release that races an Accounting cancel.
  - Every other wait (awaited invoice failed, needing a person, or not registered) raises the delayed-accounting alert after 6 hours, with `documentType: "payment"`.
  - The row and the details name what the payment waits for.
  - Invoices now waiting for their contact are not in the 6-hour count, but Bid invoices are still covered by the existing 30-minute delayed Bid invoice alert. No path was found where a payment waits with no alert and no parked state.
- **F5: holds** (web tests and screenshots).
- **F6: holds, but only one way** (N3). Parked rows are cancelled with history before 0379's rules come back, so the earlier release cannot requeue a parked delivery draft.
- **F7: holds.**
  - `noStore` is registered on `/finance/accounting` and `/finance/accounting/*` before the finance gate, and it sets the header after the chain has run.
  - A minimal Hono reproduction of the same ordering confirms the header is present on the gate's 403 and on a 500 from a throwing handler, as well as on the 200/400/403 the route tests assert.
- **F8 to F10: hold** as described.
- **Dry run.**
  - `DELIVERY_BOOKING` is still `null`, and no infrastructure, environment or deploy file changed.
  - No Zoho Books adapter change targets `live` or `test_org`.
  - Every send in these tests went to the in-memory Books.

### Findings

#### N1 — Low — The release decision is not atomic with the Bid rows it was made on

`release` reads the Bid rows, decides, and then moves the document in a separate transaction, and nothing locks the rows it decided on. In RC3, the Bid invoice was voided again by a concurrent commit after the check had read it. The payment was still released, and the next tick issued it to Books against an invoice that is voided in Bid.

- **Unlike RC4:** an Accounting cancel is re-parked by `parkStranded`. A Bid void is not.
- **Why only Low:**
  - The window is the few milliseconds between the read and the move.
  - It needs a staff void at that exact moment.
  - The same thing can already happen when an invoice is voided just after a payment is projected.
  - Books is dry run only.

**Fix:** in the release transaction, after locking the document, re-read the deciding Bid row with `FOR SHARE` (`bid_invoice.voided_at` for `invoice_cancelled`; the group and its `payment_group_delivery` rows for `vat_on_delivery`) and refuse if it no longer matches. Or pass the rows' version into `transitions.apply` and compare there. Add RC3 as a regression test.

#### N2 — Low — The 0382 rebuilt-draft clause pins only the reference, kind and gross

As `api_app`, a release of a parked delivery invoice may also, in the same update:

- swap `payload.contactReference` to another contact;
- drop the payload's lines;
- move `net_pence`/`vat_pence` freely while keeping the gross (RC5).

The application path cannot do any of this: `readDocumentPayload` re-checks the rebuilt document. But the trigger is the database's guard against a faulty or compromised API, and a swapped contact would send a delivery invoice to the wrong customer's account once Books is live.

**Fix:** in the clause, also require:

- `NEW.payload -> 'contactReference' = OLD.payload -> 'contactReference'`;
- the same currency and date fields;
- `NEW.net_pence + NEW.vat_pence = NEW.gross_pence`;
- the payload's line total equals `NEW.gross_pence`.

Add these three probes to `api-app-role.contract.test.ts`.

#### N3 — Low — Rolling back 0382 abandons every parked document for good

The rollback cancels all parked rows. After 0382 is applied again they stay `cancelled`, and no path brings them back: Release only takes a parked row, a cancelled row keeps its LAX reference, and there is no re-projection tool. The rollback header's "projected anew only by a person" names a step that does not exist. In this recheck, 27 parked documents (8 of them payments) were left `cancelled` after rollback and forward. Harmless in dry run, but it is a money gap if a rollback ever runs once Books is live.

**Fix:** pick one:

- Restore 0379's function in the rollback with one extra condition: refuse when `starts_with(OLD.needs_review_reason, 'accounting_parked_')`. Leave the parked rows as they are. The earlier release then cannot requeue them, and re-applying 0382 brings Release back. This was the second option in F6.
- Keep the cancel, but say in the rollback header and the runbook that the rollback must not run once Books has left dry run, and list the cancelled references.

#### N4 — Info — The database cannot tell a release of a still-parked row from a settled one

As `api_app`, parked to `pending` with the document unchanged is allowed whatever the Bid rows say (RC5). The fixer records this as a residual. It is accepted: whether the reason is settled is the application's decision, and that guard is covered (MR1).

#### N5 — Info — The payment-waiting alert

- It reuses the `accounting_bid_invoice_delayed` message, so it groups with the buyer-invoice alert in the alerting tool. It also measures age from `created_at`, so a payment released after a long park alerts at once if its invoice is not yet issued.
- **Fix:** consider its own message key, and measuring from the last transition (`updated_at`).

#### N6 — Info — Audit events are written after the move commits

The `release_requested` audit event is written after the move has committed, not in the same transaction, the same as the existing `retry_requested`. If the publish fails, the `release` history row still names who asked. This is acceptable, and it is noted for consistency with the audit log.

### Severity table

| # | Severity | Area | Summary |
|---|---|---|---|
| N1 | Low | Money / concurrency | Release check and move are not atomic with the Bid rows; a concurrent re-void can let a payment through (RC3) |
| N2 | Low | DB / defence in depth | 0382 rebuilt-draft clause lets `api_app` change the contact, lines and VAT split with the same reference and gross |
| N3 | Low | DB / ops | 0382 rollback is reversible for the schema but abandons parked documents for good |
| N4 | Info | DB | Settled-or-not is the application's decision (accepted residual) |
| N5 | Info | Ops | Payment-waiting alert shares the invoice-delayed message; age from `created_at` |
| N6 | Info | Audit | Audit event written after the move commits (as for Try again) |

The ten review findings are fixed as the table claims, and the owner's rules still hold:

- Dry run only.
- Delivery stays parked and is never sent until it is released.
- Amounts come from stored rows, and allocations are exact.
- Release is permission-gated server-side, recorded in history and audit, and serialised against itself and against cancel.

N1 to N3 are small, are not reachable in dry run, and should be closed before Books leaves dry run.

### Recheck verdict: SHIP
