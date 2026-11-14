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
