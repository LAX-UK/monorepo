Verdict: FIX FIRST

# Review of PR #1460: seller and artist payouts as Books bills (plan v2, PR 12)

Head reviewed: `142d7057` on `books-payout-bills-bk12` (one commit on top of `70ceb4c4`).

Both blocking items are CI or test problems, not money problems. The money logic checks out: the bill always equals the payout row's net to the penny, nothing can reach a live Books org, and the vendor contact always sits with the right legal entity.

## Findings

1. **BLOCKING** `apps/worker/src/container/worker-store-role-contract.integration.test.ts:486`: the new `DrizzlePayoutAccountingFactsReader`, built in `apps/worker/src/container/create-accounting-runtime.ts:121`, is not listed in `STORES` or in `COVERED_ELSEWHERE` (line 160). The test "has a probe for every store a container file builds on the database" fails both locally and in CI: the `worker-role-contract` check on the PR is `failure`. The fix is to add probes for `bidPayout` and `shopArtistPayout` running as `worker_app`. That would also show, through that suite, that worker_app can read `payout`, `payout_line`, `sale_seller_terms`, `legal_entity`, `shop_party` and the new `shop_payout_ledger` columns. The payout integration test already reads a Bid payout as worker_app.

2. **BLOCKING** `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:224`: the 0391 rollback test rolls back 0392 and then 0391, but not the new 0393 first. On a database migrated to 0393 it now fails with "Migration history is missing 1812024000000 before applied timestamp 1812196800000". I reproduced this on a fresh Postgres 16 database, running the `@auction/db` suite one file at a time. It is the only failure in that run (1214 passed). Run `0393_rollback.sql` first, as this test already does for 0392.

3. `packages/accounting-domain/src/projection/payouts.ts:146,159,180,212`: mutation results for the sum checks. Disabling any one of the four checks (payout net = gross - fees, sale split, sales add up to the ledger, bill total = net) leaves `payouts.test.ts` green, because another check always catches the fixture. Disabling pairs shows the bill-total check (line 212) is the backstop: with it on, no mutation lets a wrong total through, and disabling it together with line 180 is caught. The money is therefore safe: the bill can never differ from the ledger net. But each check has no test of its own. Three cases are untested:
   - the hammer-vs-gross half of line 180, where the sales' hammers do not sum to the payout gross while the nets agree (narrowing line 180 to `owed !== facts.netPence` passes every test);
   - line 146 on the non-itemised path (`otherLines > 0`), where it is the only guard;
   - line 159, where a wrong split on one sale is offset by another sale.

   Not blocking: add one refusal case per check.

4. `packages/persistence/src/repositories/accounting/drizzle-payout-accounting-facts.reader.ts:83-93`: a snapshot line is itemised without checking these things:
   - that `sale_seller_terms.seller_legal_entity_id` is the payout's `legal_entity_id`;
   - that `basis = 'agreement'` and `agreement_id` is set. The null checks only cover `held` rows indirectly. The brief says the commission must come from a signed agreement.
   - that `commission_vat_pence` agrees with `commission_vat_bps`.

   The commission and VAT figures are taken from the snapshot exactly as settlement took them, so they match the existing rules by construction, and the bill's money is the ledger net either way. Not blocking: add these three conditions to `priced` so a snapshot with a mismatch is parked as `payout_lines_unmapped` instead of being itemised.

5. `packages/db/drizzle/0393_rollback.sql:18-22`: the rollback cancels only unsent `bill_payment` rows. Unsent vendor contacts (`LAX-<P>-CON-vendor-…`, never parked) and payout bills stay pending. The earlier release sends every contact through the customer port (`accounting-dispatch.ts` before this PR), so after a rollback a vendor would be rehearsed or sent as a customer. This is harmless while Books is dry run only. Before any mode that writes, either cancel pending `CON-vendor-` contacts and the payout bills in the rollback, or say in the runbook that they must be cancelled. Not blocking. I ran the rollback against a migrated database: it applied cleanly, `db:migrate` then reapplied 0393, and the kind CHECK came back validated and including `bill_payment`.

6. `packages/accounting-zoho-books/src/adapter/kinds.ts:87`: the `/vendorpayments` field names (`payment_id`, `payment_number`, `paid_through_account_id`, `bills[].amount_applied`) are marked "to confirm in the test organisation". This is fine while Books is dry run only. Confirm them before the test-org mode is enabled for payouts. Not blocking.

7. `packages/accounting-domain/src/projection/payouts.ts:36,39`: both bookings are `null`, so every payout bill and payment is parked. The `api_app` trigger in `0393_books_payout_bills.sql` refuses to move the four new park reasons, and the integration test "api_app cannot release a parked payout document, even unchanged" confirms it. The `commission: "netted"` design books no document for the VAT on commission (LAX's output VAT). That VAT has to appear in the accounts somewhere, so it is a question for the accountant to answer before the booking is set. Not blocking, because nothing is posted until then.

## Verified (no change needed)

- **No live posting.** `packages/finance-runtime/src/books/create-books-accounting-adapters.ts:50` still builds only the dry-run adapter, and this PR leaves the mode and destination-binding code unchanged. Mutation: making `checkDestination` (`packages/accounting-domain/src/destination.ts:52`) accept any destination in `dry_run` makes "dry run makes no Books call" fail. With the code restored, all 11 payout integration tests pass.
- **Parking gate.** Mutation: treating the booking as answered fails two tests in `payouts.test.ts`.
- **Bill total.** The bill equals the payout's net to the penny. Its lines come one per lot sale from the seller-terms snapshot, with hammer, commission and commission VAT stated in each line's text. VAT on the bill is 0, and `not_registered` with any commission VAT is refused (mutation killed). A payout with Stripe fees or other lines is billed as one line of its net and parked for a person.
- **Shop artist payouts.** They work the same way: the bill is the ledger row's net (gross - deductions, mutation killed), it is paid from Stripe clearing only through a Connect transfer, and a payout marked paid by staff has its payment parked. LAX's own stock is skipped. worker_app is refused `paid_reference` (permission error 42501, tested).
- **Money format.** Amounts are integer pence throughout: bigint pence are cast in SQL (`(x * 100)::bigint`), `poundsText` uses no floating point, the currency must be GBP, and other currencies are skipped.
- **Idempotency.** Keys are `LAX-<P>-BILL|BPAY-<payout>` and `LAX-<P>-CON-vendor-<id>`. Six concurrent projectors plus a redelivery give one document each. If the figures change after registration, the document is refused for a person (integration test).
- **Legal entities.** The vendor contact is per legal entity and product. Bid documents go to `london_auction_xchange` and Shop documents to `london_art_exchange` (asserted). A payment naming another product's bill is refused (`entityMismatch`), and a bill paid to a customer contact is refused.
- **Migration.** The rollback pair exists. The journal entry idx 385 / `when` 1812196800000 follows 0392. Worker read grants were added for `shop_payout_ledger` columns only. No grant change for api_app beyond the trigger refusal.
- **No Xero changes, no secrets** in the diff.

## Runs

Environment: a throwaway Postgres 16 on port 55432 (`db:migrate` and `db:roles` with role passwords).

- `apps/worker` accounting and container tests: 382 passed, 1 failed (finding 1).
- `payout-bills-books.integration.test.ts`: 11/11 passed.
- Package test suites:
  - accounting-domain: 403 passed.
  - accounting-zoho-books: 346 passed.
  - persistence: 1002 passed.
  - types: 333 passed.
  - db, run one file at a time on a fresh database: 1214 passed, 1 failed (finding 2).
- Typecheck of worker, persistence, accounting-domain, accounting-zoho-books, db and types: clean.
- Biome on the changed files: clean.
- PR checks when this review was written: `worker-role-contract` failure; the others were passing or still running.
