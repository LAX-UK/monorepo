Verdict: SHIP

# Recheck of PR #1460: seller and artist payouts as Books bills (plan v2, PR 12)

Head rechecked: `e763cf7d` on `books-payout-bills-bk12` (five commits after the first review's `142d7057`). The head did not change during the recheck.

Both blocking findings from the first review are fixed, and so are the three non-blocking items the fixer took on (one refusal test per sum check, the snapshot itemisation conditions and the rollback). No new blocking problem was found. The commit messages on the PR carry no attribution trailers.

## Findings

1. Fixed (was BLOCKING): `apps/worker/src/container/worker-store-role-contract.integration.test.ts:150,366-367`. `DrizzlePayoutAccountingFactsReader` is in `STORES`, and `bidPayout` and `shopArtistPayout` are probed as `worker_app` against rows added to `packages/db/scripts/seed-worker-role-contract-probes.ts:158-175` (a Bid payout with one line, and a Shop payout ledger row). The three worker role-contract files pass against real Postgres 16 after `db:migrate`, the probe seed and `db:roles` (487 tests, including "has a probe for every store a container file builds on the database"). Mutation: revoking SELECT from `worker_app` on `sale_seller_terms`, `legal_entity`, `shop_payout_ledger` or `payout_line`, one at a time, makes a payout probe fail each time. CI `worker-role-contract` is green.

2. Fixed (was BLOCKING): `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:224`. The test now rolls back 0393, then 0392, then 0391. The whole `packages/db` suite passes on a fresh database after `db:migrate` and `db:roles`: 213 files passed, 2 skipped; 1190 tests passed, 42 skipped. The skipped tests are the api, shop and auth role contracts, which need their own role URLs and run in their own CI jobs.

3. Fixed: `packages/accounting-domain/src/projection/payouts.test.ts:171-226`. There is now one refusal test per sum check. Each mutation below makes at least one test fail:
   - turning off the net = gross - fees check (`payouts.ts:146`);
   - turning off the per-sale split check (`payouts.ts:159`), which also covers a wrong split on one sale offset by another;
   - keeping only the hammer half of `payouts.ts:180`;
   - keeping only the net half of `payouts.ts:180`;
   - turning off the Shop net check (`payouts.ts:329`).

   The bill-total check at `payouts.ts:212` cannot fail by itself: the lines are built from the sales, and those have already been checked to add up to the net. It is a backstop. Paying a line at the hammer instead of the seller's net (`payouts.ts:188`) makes four tests fail whether or not line 212 is enabled. Not blocking.

4. Fixed: `packages/persistence/src/repositories/accounting/drizzle-payout-accounting-facts.reader.ts:31-45,114-122`. A snapshot line is itemised only when all of these hold:
   - `basis = 'agreement'` and an agreement is set;
   - the seller legal entity is the payout's own;
   - the commission VAT equals `vatForLine(commission, treatment, commission_vat_bps)`.

   `vatForLine` is the same rule settlement uses (`packages/domain/src/seller-proceeds.ts:113`), so a correct snapshot always matches. The 0372 shape CHECK requires `commission_vat_bps` on every agreement row, so a not-registered seller is not parked by mistake. The integration tests for another seller's snapshot and for a VAT rate that disagrees both pass.

5. Fixed: `packages/db/drizzle/0393_rollback.sql:16-29`. I rehearsed this on a copy of the test database, with one unsent row of each of these kinds: bill, bill payment, vendor contact and customer contact. After the rollback:
   - the bill, the bill payment and the `LAX-BID-CON-vendor-…` contact are cancelled, each with one `cancel` history row (`reason = rollback_0393`);
   - the customer contact is still pending;
   - the script applied cleanly.

6. Still open, not blocking (unchanged from the first review): `packages/accounting-zoho-books/src/adapter/kinds.ts:87`. The `/vendorpayments` field names are still to be confirmed in the Books test organisation before payouts are enabled there. The PR body records this.

7. Still open, not blocking (unchanged from the first review): `packages/accounting-domain/src/projection/payouts.ts:36,39`. Both payout bookings are null, so every payout bill and payment is parked. The accountant still has to say where LAX's output VAT on commission is booked under `commission: "netted"`. The PR body lists this as an accountant question.

8. Not blocking: `apps/worker/src/finance/accounting/payout-bills-books.integration.test.ts`. One run out of eight had 1 failure in 13 tests. It ran while the `packages/db` suite was loading the same Postgres server. The other seven runs, and the run inside the full `src/finance` suite, passed 13/13. The failing run's output was not kept, so the case is unknown. Worth watching for flakiness in CI. CI's `test` job was still running when this was written.

## Still holds: no live posting

- `packages/finance-runtime/src/books/create-books-accounting-adapters.ts:50` builds only the dry-run adapter (`byMode: { dry_run: … }`).
- The PR does not touch `finance-runtime`, `destination.ts`, modes, bindings, deploy or infrastructure files.
- The integration test "dry run makes no Books call" passes.

## Runs

Environment: Postgres 16 under `/var/tmp`, port 55432, after `db:migrate`, the worker probe seed and `db:roles`. Vitest ran with `--maxWorkers=2`, or 1 for the database suites.

| Area | Result |
|---|---|
| accounting-domain | 409 passed |
| accounting-zoho-books | 346 passed |
| types | 333 passed |
| finance-runtime | 256 passed |
| persistence `src/repositories/accounting`, `src/lib` (DB) | 219 passed |
| worker `src/finance`, `src/projectors`, `src/container` (DB, `worker_app`) | 1071 passed |
| worker role-contract files (CI set of three) | 487 passed |
| `payout-bills-books.integration.test.ts` | 13/13 in seven of eight runs (finding 8) |
| packages/db, full suite, fresh database | 1190 passed, 42 skipped (role URLs) |

- `turbo typecheck` for worker, persistence, accounting-domain, accounting-zoho-books, db, types, finance-runtime and api: 37/37 tasks pass.
- `biome check` on the changed files: clean.
- `lint:layers`, `lint:deps` and `scripts/check-layers.mjs`: pass.

PR checks on `e763cf7d`:

- 36 passed, including `static-checks`, `worker-role-contract`, `build`, the api, web and shop-api vitest jobs, and `account-browser-gates`.
- 1 skipped: `art-browser-gates`.
- Still running when this was written: `test` and `browser-gates`.

Commit messages on the PR: none has a `Co-Authored-By` or "Generated with" line.

The migration number 0393 is shared with other open PRs and is renumbered at ship time. Not blocking.
