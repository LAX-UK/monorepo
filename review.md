Verdict: SHIP

# Review of PR #1566: Partial credit notes, allocate VAT per line as Zoho Books computes it

Reviewed head `5a53a563` against `main` `7dfd2356`. The PR branch was not changed.

## Summary

The new allocation fixes the bug it targets. For each partial credit line it uses
`round_half_up(gross/6)`, in BigInt and integer pence, and it keeps every invoice line whole.
When the credit that finishes a line would round differently in Books, it splits that credit. My
own random runs found no case where the credits plus what is left fail to reconcile.

One regression blocks the merge. A credit note stored under the old cumulative rule can now be
replayed onto a different invoice line. After that, a valid later credit that `main` accepts is
refused. The PR claims that stored credit notes "still replay", and that claim does not hold.

## The 1p mismatch on main was real

- `main`, invoice line of 21p net + 4p VAT (25p gross), credit 3p. Cumulative rule:
  `round_half_up(4 x 3 / 25) = round(0.48) = 0p`. Books, which computes VAT inside an inclusive
  line: `round_half_up(3 x 2000 / 12000) = round(0.5) = 1p`. The adapter refused this note
  (`zoho_books_mapping_vat_differs_from_books`).
- I swept every single partial credit on lines of 1..300p net (53,880 cases). `main` was off by
  1p in **5,340 (9.9%)**, which matches the README's "1 in 9". The PR is off in **0**.

## Blocking finding

### B1. Stored cumulative-rule credit notes can replay onto the wrong line, so later credits are refused

`packages/accounting-domain/src/document.ts:747-757` (`creditedEntry`)

On `main`, `creditedEntry` matched a credit line against the first entry with room that rebuilds
under the cumulative rule. Now it tries `books`, then `cumulative`, on each entry. A stored
(legacy) credit can therefore match an *earlier* line with the same description and treatment
under `books`, even though `main`'s builder recorded it on a later line. The replay no longer
reproduces the ledger the note was built against.

How to reproduce (I built the legacy note with `main`'s dist and replayed it with the PR's):
- Invoice with two goods lines, both `"Print"` and standard rated: 37p net (44p gross, 7p VAT)
  and 33p net (40p gross, 7p VAT).
- On `main`, a named credit (`lines: [1]`) of 33p on line 2 gives `Credit: Print` 33p gross with
  6p VAT. The cumulative rule on line 1 gives 5p, so `main` records the credit on line 2.
- PR `creditedOnInvoiceLines` returns `[33, 0]`. `main` returns `[0, 33]`.
- A named credit for all of line 1 (`lines: [0]`, 44p) succeeds on `main`. On the PR it is
  refused with `exceeds_invoice`.

In 20,000 random legacy named-credit chains on two lines sharing a description, this happened
once. It is rare, but it is a regression from `main`. It can only reach standard-rated documents,
and Shop uses named lines (`projection/shop-refunds.ts`, through `creditedOnInvoiceLines` and
`placeRefund`) with descriptions taken from free-text labels. Bid lines are all margin scheme
with 0 VAT, so the two rules agree there. No money is over-credited, because role totals and the
VAT bounds still hold. The failures are a refund stuck in refusal and wrong per-line "credited"
figures for Shop placement.

Fix: decide the rule per note, not per line or entry. Store a rule or version marker on the note,
or use an issued-on or created-at cutover. Replay legacy notes with the cumulative rule only,
which is exactly `main`'s replay, and new notes with `books` only. Then add a regression test
with two same-description lines, like the case above. A note-level "try books, else cumulative"
is not enough: in the case above the single line already matches line 1 under `books`.

The same widened matching also lets a *new* named credit be recorded on an earlier line that
matches only under the legacy rule. The builder and the replay share the function, so the two
stay consistent, but the line becomes more ambiguous than it needs to be. The fix above removes
this too.

## Non-blocking findings

1. **The Books rounding rule is still an assumption.** See
   `packages/accounting-zoho-books/README.md:118` and `adapter/mappers/common.ts` `booksLineVat`.
   The PR's headline case (3p of 25p becomes 1p) is an exact half, so it holds only if Books
   rounds half-up. Under banker's rounding it would be 0p. I found no Zoho Books documentation
   that states per-line half-up rounding for tax-inclusive lines. Search turned up only community
   threads that report line versus transaction rounding differences. The existing invoice path
   makes the same assumption (`vatForLine` is half-up per line, and so is `booksLineVat` for
   exclusive lines), so the PR is consistent with the repo. The adapter gate and the read-back
   total comparison keep a wrong assumption fail-safe: it would send notes to staff, not post
   wrong VAT. Confirm this in the test organisation before relying on it.
2. **Half-up bias builds up over many partials of one line**
   (`document.ts:605-616`, `creditVat`). Every gross ≡ 3 (mod 6) rounds 0.5p up. Example: a line
   of 120p gross with 20p VAT, credited 3p at a time. The first 20 credits take 1p each, which
   uses the whole 20p of VAT after 60p of gross. The next 19 partials carry 0p where Books takes
   1p, so all of them are refused for staff. Totals stay exact (20p credited in all). The README
   documents this, and it is unrealistic in practice, but `cumulative` never drifted like this.
   This is an accepted trade-off, not a defect.
3. **Stale docstring.** `document.ts:835` (`buildCreditNoteFor`) still says a credit line's VAT
   is "the cumulative share of the line's VAT". Update it to describe the `books` rule and
   splitting.
4. **No cap on credit-note lines.** Splitting turns one finishing credit into up to 4 lines
   (`MAX_SPLIT_PARTS = 3` plus the rest, `document.ts:644`). Credit notes have no `MAX_LINES`
   check, while invoices do (`document.ts:311,417`). A full credit of a 1000-line invoice could
   reach about 4000 lines. Totals are still far inside safe integers, but Books may have a
   per-document line limit. Consider a cap or a refusal.
5. **Test gaps.** The new mapper property tests (`adapter/mappers/credit-note.test.ts`) use only
   single-line, standard-rated invoices. There is no test with mixed treatments or several lines,
   and no legacy-replay test where two lines share a description (that would have caught B1). My
   own runs covered those areas, see below.

## Checks that passed

- **Totals never exceed the original line or invoice.** `creditVat` keeps
  `creditedVat ≤ line VAT`, and the `low` bound keeps the remaining VAT inside the remaining
  gross. The finishing credit takes exactly the VAT left.
  - 3,000 random multi-line runs with mixed treatments (standard, zero, exempt, margin scheme,
    outside scope; goods and delivery; descriptions reused on purpose), each credited in fill
    mode until full. Credit totals equal the invoice net, VAT and gross exactly every time. The
    replay always returns every line fully credited. Every amount is a safe integer.
- **Several partial credits sum exactly to the invoice.** Shown by the runs above, and by the
  PR's own property tests.
- **Mismatches with Books on short chains.** 5,000 runs on 2–4 line invoices with mixed
  standard and zero lines, two partial credits then the rest, produced 26,641 credit lines and
  **0** that differ from Books.
- **Zero-rated, exempt, margin-scheme (Bid hammer and buyer's premium,
  `projection/bid.ts:50-52`) and outside-scope lines.** `vatInsideGross` returns 0 for these, so
  the credits carry 0 VAT and are never split.
- **Mixed rates.** The domain has only the 20% standard rate. The split period comes from
  `STANDARD_VAT_RATE_BPS` (6p). The split search is at most 3 parts × 6 sizes, so it is bounded
  and deterministic.
- **Integer pence only.** The new arithmetic is BigInt or integer: `vatInsideGross`, `gcd`, the
  split search. No floats appear.
- **A full credit of an exclusive invoice line in one note matches Books, with no split.**
  `|v − g/6| ≤ 5/12` holds for half-up exclusive VAT. The PR's money test checks this too.
- **The Xero path is unchanged.** No Xero files are touched, and Xero code does not call
  `buildCreditNoteFor`.
- **Dry-run is unaffected.** The adapter change is a comment only, and `dry-run.test.ts` passes.

## Test runs

All at PR head, with `--maxWorkers=2`, against a throwaway Postgres 16 on port 55432 (migrations
and role grants applied):

| Suite | Result |
| --- | --- |
| `@auction/accounting-domain` | 21 files, 418 tests passed; `tsc` clean |
| `@auction/accounting-zoho-books` | 16 files, 351 tests passed; `tsc --noEmit` clean |
| `@auction/persistence` `src/repositories/accounting` (integration, DB) | 4 files, 87 tests passed |
| `apps/worker` `src/finance/accounting` (incl. `bid-refunds-books.integration.test.ts`, 30 tests on DB) | 25 files, 347 tests passed |
| `biome check` on both packages | clean |

## Fixes after review

Fixed in `fee03fc6` on `fix/partial-credit-books-vat`, after `be427ba3` merged `main` (`7dfd2356`) into
the branch. Line numbers are at `fee03fc6`.

### B1. The VAT rule is now decided per credit note (fixed)

- `packages/accounting-domain/src/document.ts:188`: `CreditNote.creditVatRule?: "books"`. Every new note
  carries it. It is stored in the `accounting_document.payload` JSON, so no migration is needed. A note
  without it was stored before this change, so it was made with the cumulative rule.
- `document.ts:200`, `:203`: the `CreditVatRule` type, and `creditVatRuleOf(note)`, which returns
  `books` when the marker is present and `cumulative` otherwise.
- `document.ts:768` (`creditedEntry`): matches under one given rule only. The loop that tried `books`
  and then `cumulative` on each entry is removed.
- `document.ts:828` (`replayPriorCredits`): every line of a prior note is replayed with that note's own
  rule. A legacy note replays with the cumulative rule only, which is exactly `main`'s replay. A new
  note replays with `books` only. An unknown rule is refused.
- `document.ts:688` (`creditLines`): the cumulative rule is never split. New notes are built with
  `books` only.
- `document.ts:894`: `buildCreditNoteFor` takes an optional `creditVatRule`, used only to rebuild a
  stored note exactly as it was made. With `cumulative` the builder is `main`'s builder, and the note
  carries no marker.
- `packages/persistence/src/lib/accounting-document-payload.ts:160`: the payload reader accepts only
  an absent marker or `"books"`, and only on a credit note.
- `packages/accounting-domain/src/projection/bid-refunds.ts:166,252,393,467` and
  `packages/finance-runtime/src/books/accounting-queue.service.ts:431,449`: releasing a parked Bid
  credit note now rebuilds it with the stored note's own rule. Without this, every legacy parked note
  would have come back as `document_changed`.

Tests:
- `packages/accounting-domain/src/document.test.ts:877`: the review's case. Two standard-rated
  `"Print"` lines, 37p and 33p net. A legacy named credit of 33p on line 2 (`Credit: Print`, 33p gross,
  6p VAT, as `main` makes it) replays as `[0, 33]`. A full credit of line 1 (44p, 7p VAT) then
  succeeds, and the replay gives `[44, 33]`.
- `document.test.ts:901`: a new note is never matched under the legacy rule. A 3p credit of 21p+4p
  carries 1p VAT. Without its marker it does not replay, and a legacy 0p line marked `books` does not
  replay either.
- `document.test.ts:940`: a property test, 400 runs. Legacy named chains on two same-description lines
  replay as they were made, and the rest of each line can then be credited in full, with exact VAT.
- `packages/persistence/src/repositories/accounting/accounting-credit-notes.integration.test.ts:234`:
  the marker round-trips, a legacy note is read back unmarked, and `"cumulative"` is refused as
  `bad_document`.
- `apps/worker/src/finance/accounting/bid-refunds-books.integration.test.ts:770`: a parked
  buyer-default note with the marker removed is rebuilt on release, and it reaches the database (the
  0385 `42501`), not `document_changed`. I checked that this test fails with the `finance-runtime`
  change reverted.

### Non-blocking findings

1. **The Books rounding rule (left for the accountant).** No code change. The note in
   `packages/accounting-zoho-books/README.md:123` now says it needs the accountant or the Books test
   organisation. It also says that the headline case is an exact half, which banker's rounding would
   give as 0p, and that a wrong assumption fails safe. The PR body says the same.
2. **Half-up drift over many partials (accepted).** This is documented in the README (`:119` area). No
   code change.
3. **Stale docstring (fixed).** `document.ts:862`: the `buildCreditNoteFor` doc now describes the
   per-note rule, the `books` allocation, splitting and the line cap. The mapper comment is updated at
   `packages/accounting-zoho-books/src/adapter/mappers/credit-note.ts:35`, and the persistence
   `readLines` doc is updated too.
4. **No cap on credit-note lines (fixed).** At `document.ts:925`, if the splits would take a note past
   `MAX_LINES`, the note is rebuilt without them (`creditNoteLines`, `:957`). Without splits a note has
   at most one line per invoice line. The unsplit lines replay under `books` and the adapter refuses
   any that differ from Books. A note that is still too long is refused with `too_many_lines`. This
   is tested at `document.test.ts:989`: a 1,000-line invoice whose rest would need 1,001 lines.
5. **Test gaps (fixed).** `packages/accounting-zoho-books/src/adapter/mappers/credit-note.test.ts:168`
   adds 1,500 random runs on 2–4-line invoices with every treatment, goods and delivery, and reused
   descriptions. Each run is two partials then the rest. Every line matches `booksLineVat`, except a
   rest that no whole-pence split can carry. The totals equal the invoice exactly. The
   legacy-replay test with two lines sharing a description is covered under B1 above.

### Unchanged

The Xero path is untouched, and dry-run behaviour is unchanged (the adapter change is comment only).

### Test runs at `fee03fc6`

All with `--maxWorkers=2`, against a throwaway Postgres 16 on 55432 after `db:migrate` and `db:roles`:

| Suite | Result |
| --- | --- |
| `@auction/accounting-domain` | 21 files, 424 passed; `tsc` clean |
| `@auction/accounting-zoho-books` | 16 files, 352 passed; `tsc --noEmit` clean |
| `@auction/finance-runtime` | 35 files, 259 passed; `tsc --noEmit` clean |
| `@auction/persistence` `src/repositories/accounting` (DB) | 4 files, 88 passed; `tsc --noEmit` clean |
| `apps/worker` `src/finance/accounting` (DB) | 25 files, 348 passed; `tsc --noEmit` clean |
| `apps/api` accounting suites | 4 files, 143 passed; `tsc --noEmit` clean |
| `biome check` on the changed files | clean |

## Final recheck

Rechecked PR head `fee03fc6` (the fix, on top of the `main` merge `be427ba3`). The PR branch was not changed.

**B1 is fixed. The VAT rule is decided per credit note.**
- A new note always carries `creditVatRule: "books"`. A note without the marker is `cumulative` (`creditVatRuleOf`).
- `replayPriorCredits` replays every line of a prior note with that note's one rule. `creditedEntry` takes a single rule, and the old books-then-cumulative loop is gone.
- An unknown marker is refused, both in the domain and in the persistence payload reader.

**Legacy notes replay exactly as on `main`.** I checked this independently, without relying on the PR's own tests, which build "legacy" notes with the PR's `cumulative` builder. I compiled `accounting-domain` from `main` (`7dfd2356`) and from the PR. I built legacy credit chains with **main's** `buildCreditNoteFor`, using random 1–4-line invoices with every treatment, goods and delivery lines, a reused `"Print"` description, and both named and fill credits. For each chain I then compared:
- `creditedOnInvoiceLines` from main and from the PR, after every note: **0 differences in 46,489 replays** (4 seeds × 5,000 runs).
- The PR's builder with `creditVatRule: "cumulative"` against main's builder, for the same inputs: **byte-identical in every case**, with no marker. So a parked legacy note rebuilt on release (`bid-refunds.ts`, `accounting-queue.service.ts`) is exactly what `main` stored.
- New `books` notes stacked on those legacy chains, with partials and then the rest of every line: **0 refused**. Credit totals equal the invoice's net, VAT and gross exactly, and every line ends fully credited. Every new partial line carries `vatInsideGross`. About 0.2% of finishing lines differ from Books, all of them finishing a line that legacy partials left with a remainder no whole-pence split can carry. The adapter refuses these lines to staff. This fails safe and is documented.

**New notes use the Books rule only.** The cumulative rule is never split, and it is used only when a caller passes a stored note's rule. The test "a new credit note is never matched under the legacy rule" checks that neither rule falls back to the other.

**The review's 37p/33p regression test passes.** `document.test.ts`: "a legacy named credit of 33p on line 2 replays on line 2, and line 1 can then be credited in full". The replay gives `[0, 33]`, then line 1 is credited in full for 44p with 7p VAT, then `[44, 33]`. My main-built check reproduces `[0, 33]` from main's own note.

**Integer pence.** Every line amount and total in the runs above is a safe integer, and the new arithmetic is integer or BigInt.

**Migration.** There is none. The marker lives in the existing `accounting_document.payload` JSON, so no `_journal.json` entry is needed. The PR touches no `packages/db` or migration files. Existing rows read back unmarked, which means cumulative, so the default is safe. The persistence integration test round-trips both the marked and the unmarked note and refuses `"cumulative"`.

**Xero and dry run are unchanged.** No Xero or dry-run files are in the diff, and the Zoho adapter change is comment only. Worker `xero` suites: 3 files, 8 passed. Zoho Books `dry-run.test.ts` passes within the package run below.

**The non-blocking findings are handled.**
- N3 docstring: updated.
- N4 line cap: when the split lines would exceed `MAX_LINES`, the note drops the splits, and refuses with `too_many_lines` if it is still too long. Tested.
- N5 tests: multi-line, mixed-treatment mapper property test added.
- N1 and N2 remain documented assumptions or trade-offs, as agreed.

I also checked that the marker does not cause `reference_in_use` or `document_changed` on replay:
- The registry compares payloads with deep equality. A re-projected refund event reads its own note among the prior credits, so it does not rebuild the same note.
- The Shop history import queues no credit notes.
- A parked note is rebuilt with its stored rule. The worker test `bid-refunds-books.integration.test.ts` covers this.

No new defects found.

Runs at `fee03fc6`, on a throwaway Postgres 16 at 55432 with `db:migrate` and `db:roles`, all with `--maxWorkers=2`:

| Suite | Result |
| --- | --- |
| `@auction/accounting-domain` | 21 files, 424 passed; `tsc` clean |
| `@auction/accounting-zoho-books` | 16 files, 352 passed; `tsc --noEmit` clean |
| `@auction/finance-runtime` | 35 files, 259 passed; `tsc --noEmit` clean |
| `@auction/persistence` `src/repositories/accounting src/lib` (DB) | 23 files passed, 1 skipped; 234 tests passed, 10 skipped. `accounting-credit-notes.integration` ran 11 tests. `tsc --noEmit` clean |
| `apps/worker` `src/finance/accounting` (DB, including `bid-refunds-books.integration`, 31 tests) | 25 files, 348 passed; `tsc --noEmit` clean |
| `apps/worker` Xero suites | 3 files, 8 passed |
| `apps/api` accounting-named suites | 4 files, 25 passed; `tsc --noEmit` clean |

The persistence file that was skipped is `anonymise-enquiries.api-app.integration.test.ts`. It needs an api-app DB role and is unrelated to this PR.
