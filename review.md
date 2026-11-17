Verdict: SHIP

# Review of PR #1545: Consignor agreements, part 1 (data, rules and store, migration 0407)

Reviewed against section 1, option B of `docs/design/decision-pack-2026-11-17.md` (approved, with
the Q1 to Q3 defaults). PR head `91bd8b6f`. Checked against main at `f3c88ba7`.

## Summary

The PR follows the design. It adds two new tables (`consignor_agreement` and
`artwork_consignor_link`), pure rules in `artwork-register-contracts`, a Drizzle store behind
reader and writer interfaces, and TypeBox contracts that no route uses yet. It does not reuse Bid's
`consignment_agreement`, and a test checks that. Most of the "replaced, never edited in place" rule
is enforced in the database, not only in the app: triggers, a column-level UPDATE grant and partial
unique indexes. This matches how `artwork_location_move` and other append-only tables are handled
elsewhere in the codebase. I found no defect that blocks the merge. The findings below are
hardening and follow-ups.

## Design conformance

| Design item | Where | Status |
| --- | --- | --- |
| Agreement per consignor (client = `shop_party`) | `0407_consignor_agreement.sql:21` | OK |
| Places: LAX Bid, lax.art, private sale (at least one) | `0407_consignor_agreement.sql:23-25,42-44` | OK |
| Start and end dates (end optional, inclusive, end ≥ start) | `0407_consignor_agreement.sql:26-27,45` | OK |
| Optional lowest price and commission as integers (pence, basis points) | `0407_consignor_agreement.sql:28-29,46-51` | OK |
| Signed file reference (object key, path-safe) | `0407_consignor_agreement.sql:30,52-56` | OK |
| Note, retired (by and when) | `0407_consignor_agreement.sql:31,35-37,57-65` | OK |
| Versioned; replaced, never edited in place | `0407_consignor_agreement.sql:68-139` | OK (see F1) |
| Artwork consignor link: a client or "LAX owns this work" | `0407_consignor_agreement.sql:141-155` | OK |
| Link history, change reason after the first | `0407_consignor_agreement.sql:157-199` | OK (see F2) |
| Q1: lax.art is a place on the agreement but does not block | `consignor-agreement.ts:48,326` | OK |
| Q2: checkbox fallback until 31 Jan 2027 (London), blocking after | `consignor-agreement.ts:42,327-331` | OK |
| Q3: consignor set in LAX Admin, not read from Zoho | no Zoho reads | OK |
| Option C rejected (no reuse of `consignment_agreement`) | `migration-0407-consignor-agreement.test.ts` | OK |

## Migration, rollback and chaining

- Migration 0407 comes straight after main's latest journal entry (`0406_delivery_quote_decline`,
  idx 398): it adds idx 399, and its `when` (1813406400000) is later than 0406's. The PR branch
  merges into current main without conflicts. On the merged tree, `db:migrate`, `db:roles` and
  `scripts/ci/verify-migration-pairs.mjs` all succeeded against Postgres 16.
- The rollback (`0407_rollback.sql`) refuses to run while either table holds rows. It drops the
  tables before their functions and removes its own ledger row by `created_at`, the same way the
  0406 rollback does. It has a unit test and a Postgres integration test.
- Both tables are new, and the migration sets `lock_timeout`. It does not touch Bid tables.

## Role grants (`packages/db/src/migrate-roles.ts`)

- `shop_app` gets INSERT and SELECT on both tables, and UPDATE only on the columns `status`,
  `replaced_at`, `retired_at` and `retired_by` of `consignor_agreement`. It gets no DELETE or
  TRUNCATE. This is the least privilege the store needs. The `FOR UPDATE` row lock in
  `lockLatestVersion` works because of the column-level UPDATE grant. The `FOR NO KEY UPDATE` lock
  on `artwork_register` and the `FOR KEY SHARE` lock on `shop_party` work because `shop_app`
  already has UPDATE there.
- `api_app` and `worker_app` get nothing: both tables are added to `API_DENY_TABLES`, and the
  contract tests check every privilege. I ran the `api_app`, `worker_app` and `shop_app` contract
  tests against real roles: 92 passed.

## Rules (`packages/artwork-register-contracts/src/consignor-agreement.ts`)

The rules are pure functions with no I/O and cover what the brief asked for:

- Cover of a place on a day: both end dates count, and an agreement with no end runs until it is
  retired.
- Replaced and retired versions cover nothing. An expired agreement stops covering through its end
  date; its status does not change.
- Lowest-price check: it warns and does not refuse. A price equal to the lowest price passes.
- Today is read as the London day (`dayKey(now, LONDON_TIME_ZONE)`), and there is a test for the
  summer-time edge at 23:30 UTC.
- The Q2 last day counts (inclusive).
- Validation reports all issues at once, and its limits match the DB `CHECK`s exactly.

## Store (`drizzle-consignor-agreement.store.ts`)

- Replace marks the old version `replaced` before inserting the next one, inside one transaction
  that holds a row lock. `expectedVersion` blocks a stale write. Retire uses the same path.
- `setConsignor` locks the register row, so two staff changing the same work take turns. If the
  clock steps back, `nextConsignorSetTime` stamps the change just after the previous one.
- Both interfaces are split into a reader and a writer (interface segregation), and the store
  depends on the pure rules.
- The integration tests run against Postgres, both as the owner and as `shop_app`: 13 of 13 passed.

## Findings

None of these block the merge.

**F1. The database lets a retired (or not-yet-replaced) agreement get a new version.**
`packages/db/drizzle/0407_consignor_agreement.sql:81-98`. The comment says a later version
"replaces the current version". The trigger checks only that the new version continues the old
one: same agreement, same party, and the next version number. It never checks the old version's
status. I confirmed with a direct insert as the owner: after v1 was retired, inserting v2 with
`replaces_id = v1` succeeded and left v1 `retired` and v2 `current`. That revives an agreement that
was retired. `shop_app` has INSERT, so only the store's `planAgreementChange` refuses this today
(`drizzle-consignor-agreement.store.ts:198,228`). The same gap lets a row be inserted as `replaced`
or `retired` from the start. Suggested fix: in `consignor_agreement_lineage()`, require
`NEW.status = 'current'` (and null `replaced_at`, `retired_at` and `retired_by`) on insert, and when
`replaces_id` is set, require `previous.status = 'replaced'`. The store already marks the old
version `replaced` before it inserts, so the store path keeps working. Add a matching case to
`migration-0407-consignor-agreement.integration.test.ts`. Best done in this PR, because the
migration is still provisional.

**F2. Concurrent "first set" inserts can both skip the reason (database level only).**
`packages/db/drizzle/0407_consignor_agreement.sql:165-174`. Under READ COMMITTED, two
transactions that insert the first link for the same `register_id` both see no earlier row, so
both are accepted without a reason. The store avoids this by locking the register row first
(`drizzle-consignor-agreement.store.ts:243-247`), so the app cannot reach this. Fixing it in the
database would take a `pg_advisory_xact_lock` or a lock on the register row inside the trigger.
Optional.

**F3. Only the store stops LAX's own party being used as a consignor.**
`drizzle-consignor-agreement.store.ts:297-304` refuses a `shop_party` with `kind = 'lax'`, but
neither table has a database guard against it. This is low risk. The "LAX owns this work" link
already models that case with `consignor = 'lax'`, and part 2 could add a trigger.

**F4. Contract and length limits are looser than the rules (cosmetic).**
`packages/shop-contracts/src/admin-consignor-agreement.ts:80,158` allow a 4000-character note and a
2000-character reason, while the rules and the DB allow 1000 and 500. The file says this on
purpose: the schema stops only oversized bodies, and `parseAgreementTerms` returns the field
issues. That is acceptable, but the route in part 2 must call `parseAgreementTerms` and
`planConsignorChange`, or users will get raw `check_violation` errors.

**F5. Follow-up for part 2: show expired agreements as expired.** `listAgreements`
(`drizzle-consignor-agreement.store.ts:101-116`) sorts expired agreements with the current ones,
because their status stays `current`. The UI should label them using `agreementCovers` or
`endsOn < agreementDay(now)`, so staff do not read an expired agreement as active.

## Test runs (merged tree: PR plus main `f3c88ba7`, Postgres 16)

- `packages/db`: 1412 passed, 91 skipped, 3 failed. The 3 failures are all in
  `src/auth-at-rest/run.test.ts` ("Set DATABASE_URL or DATABASE_URL_AUTH"). The PR does not touch
  that file, and it passes on its own (3 of 3). It is an environment-ordering flake when the whole
  suite runs. All 0407 tests passed: the unit test (8) and the integration test (11). The role
  contract tests passed with `api_app`, `worker_app` and `shop_app` connected: 92 passed.
- `packages/domain`: 3943 passed, 1 skipped.
- `packages/artwork-register-contracts`: 327 passed, including the new rule tests.
- `packages/persistence`: the full suite passed (it skips the integration tests). The consignor
  store's Postgres integration tests run on their own as the owner and as `shop_app`: 13 of 13
  passed.
- `packages/shop-contracts`: 127 passed.
- `apps/shop-api`: run in progress (the first run failed to load test files because the workspace packages were not built; it is being re-run after `turbo build --filter=@auction/shop-api^...`). The result will follow in the next commit. The PR adds no shop-api code, only contracts it does not import yet.
- `tsc --noEmit` passed for the 4 changed packages, and `biome check` passed on the 21 changed
  files.
