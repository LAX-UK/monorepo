Verdict: FIX FIRST

# Review of #1528 "Bid admin Deliveries, part 3: decline a delivery quote"

Reviewed head `f8a698a2` against `docs/design/staff-gaps-delivery-zoho-alerts.md` (D1-D9, mainly D5, D6, D8 and the D9 plan) and the merged PR 1 (#1517) and PR 2a (#1520, now on `main` as `7bf901a9`).

Everything was run on the PR **merged with today's `origin/main`**, which already contains #1520. The merge is clean. The setup was a local Postgres 16, `db:migrate` and `db:roles`.

Two findings block shipping:
- **F1.** The route can decline a different request from the one staff looked at. The buyer then gets the wrong reason by email. This is proven below.
- **F2.** D9 step 3 asks for the "Can't deliver" dialog in this PR, and the PR leaves it out.

The migration, grants, transaction, idempotency, validation and notice are otherwise solid, and most of the PR's mutation claims hold up. One claim does not: see F3.

## Findings

### F1. The decline is not tied to the quote staff saw, so it can decline a newer request (blocking)
- **Where:** `apps/api/src/services/organisation-buying/delivery-quote.service.ts:181-190` (`move` re-reads `findLatest(lotId, account)`), `apps/api/src/routes/admin/deliveries.routes.ts:57-62` and `packages/validators/src/admin-deliveries.ts:31` (the body is only `{reason}`).
- **The problem:** the conditional `UPDATE … WHERE status = from` only guards against a change between the server's own read and its write, which is milliseconds apart. It does not guard against a change between what staff saw and what they submitted. The PR body says the update runs "only while the quote is still in the state staff saw", and that is not true.
- **Failure scenario, reproduced with the in-memory repositories and the real services:**
  1. The buyer asks for delivery to "12 Rue Exemple, Lyon".
  2. Staff open "Can't deliver".
  3. While the dialog is open, the buyer withdraws and asks again for "34 Gallery Row, London".
  4. Staff submit "We don't ship to Lyon".
  5. Result: `{"ok":"34 Gallery Row, London","reason":"We don't ship to Lyon"}`. The London request, which no one at LAX has seen, is declined, and the buyer is emailed a reason that makes no sense for it.
- **A second case:** a colleague prices a `requested` quote (£240 sent to the buyer) while another staff member's decline dialog is open. The decline still succeeds, because `quoted` is a legal `from` state. The buyer gets "quote ready" and then "we can't deliver" moments apart.
- **What the design says:** D6 expects `quote_changed` / `quote_step_not_allowed` and the stale Notice in exactly this case ("buyer withdrew while the dialog was open").
- **Fix:**
  - Make the body `{quoteId, expectedStatus, reason}` (strict, `quoteId` uuid). The status could also come from the `If-Match` header.
  - In `StaffDeliveryQuoteService.decline`, return `quote_changed` when `current.id !== quoteId` or `current.status !== expectedStatus`. Pass `expectedStatus` as `from` to `repo.decline`.
  - Add service tests for "withdrawn and asked again" and "priced by a colleague" (both → `quote_changed`, no notice).
  - Change the contract now. Adding a required field after PR 2b ships the dialog would be a breaking change.

### F2. D9 step 3 includes the dialog, and the PR moves it to a "PR 2b" that the plan defines differently (blocking unless the plan is amended)
- **Where:** `docs/design/staff-gaps-delivery-zoho-alerts.md:171` ("3. Decline (D8): migration with rollback, domain step, route, dialog, buyer email"). D9 also asks for "light/dark/375 screenshots per PR".
- **The problem:**
  - The PR ships the route and the buyer email with no UI. Its reason was that the panel lived in the then-open #1520.
  - #1520 has now merged, so `delivery-panel.tsx` is on `main` and that reason no longer applies.
  - The PR hands the dialog to "PR 2b". The plan, decided at the #1520 review, scopes 2b as Send quote / Change quote plus the visual baseline, not the decline dialog.
  - As merged, the step is unreachable from the product. The D5 "Can't deliver" action, its D6 states and the 375 px / light / dark / keyboard checks have no owner in the plan.
- **Fix, either of:**
  - (a) Add the dialog here, now that the panel is on `main`. That means `StaffFormDialog` with a required "Reason for the buyer" (500 characters), a write-roles-only footer action in Waiting for a price / Quote sent, the D6 stale Notice, "Declined by LAX" in the timeline, and `declineReason` in `admin-deliveries.schema.ts`. Add copy in the page's copy file, screenshots at 1440/375 in light and dark, the e2e journey in CI, and no route-JS budget or baseline increases.
  - (b) Get the plan changed in the design doc (D9 step 3 and step 2b) before merging, so the dialog has a named PR.

### F3. The "audit written outside the transaction" mutation survives, contrary to the PR's test evidence
- **Where:** `packages/persistence/src/repositories/drizzle-delivery-quote.repository.ts:127` and the test at `packages/persistence/src/repositories/drizzle-delivery-quote.repository.integration.test.ts:157`.
- **Mutation:** `await tx.insert(domainEvent)` was changed to `await this.db.insert(domainEvent)`, and all 3 repository integration tests still pass.
  - The only failure test makes the audit insert fail. An insert on a separate connection then throws too, and the outer transaction rolls back, so the test cannot tell the two apart.
  - The reverse case goes undetected: the audit row commits and the quote write then rolls back, leaving a "declined" audit entry for a quote that is still open.
- **What does fail correctly:** moving the `UPDATE` out of the transaction, or dropping the transaction entirely.
- **Fix:** add a test that makes the transaction fail **after** the audit insert, then assert that no `delivery_quote.declined` row exists for the quote. One way is a `DEFERRABLE INITIALLY DEFERRED` constraint trigger on `domain_events`, or an `AFTER INSERT` trigger that raises only on a second marker. Also correct the PR body's mutation list.

### F4. The decline route has two error shapes (low)
- **Where:** `apps/api/src/middleware/admin-idempotency.ts:30-64` (this code already existed) and `apps/api/src/routes/admin/deliveries.routes.ts` (new).
- **The problem:**
  - Missing key / key reuse / in progress answer `{error: <sentence>, code}`.
  - The route's own errors answer `{error: <code>, message}`.
  - The PR body says the route uses "the existing `{error, message}` shape". The client in PR 2b has to handle both.
- **Fix:** keep both, since the middleware is shared, but document both shapes in the PR body. Add a route test asserting the 422 body `code: "idempotency_key_reuse"`.

### F5. Same idempotency key with a different body returns 422, not 409 (note, no change asked)
- **Where:** `apps/api/src/routes/admin/deliveries.routes.test.ts:197`, from `admin-idempotency.ts:63`.
- **Why no change:** 422 is the repository-wide convention for every staff idempotent route, and the PR follows it.
- **Note:** the fingerprint covers the raw body. A retry of `"  x  "` as `"x"` therefore gets 422 even though both trim to the same reason. That is harmless as long as the client resends the identical body.

### F6. `requireDeliveries` is untested (low, acknowledged in the PR)
- **Where:** `apps/api/src/routes/admin/deliveries.routes.ts:59`.
- **Mutation:** removing it leaves all 39 route tests passing. `DELIVERIES_ACCESS` and `DELIVERIES_READ_ACCESS` are the same requirement (`packages/types/src/admin-access.ts:194-195`).
- **Fix:** add a route test that mounts the routes with a read-only stub guard and expects 403 on POST. Otherwise the write guard can silently disappear when D5's View-only readers arrive.

### F7. The migration comment overstates the benefit of NOT VALID (note)
- **Where:** `packages/db/drizzle/0406_delivery_quote_decline.sql:13-27`.
- **The problem:** each migration runs in a single transaction (`runMigrationsPerTransaction`). The `ACCESS EXCLUSIVE` lock taken by `ADD CONSTRAINT … NOT VALID` is held through the following `VALIDATE`, so splitting them saves no lock time. It is harmless because `delivery_quote` is small.
- **Fix:** reword the comment, or validate in a later migration if the table ever grows.

### F8. The PR body is out of date
- It says the PR "is based on `main` and does not touch the files in #1520 (the page)". #1520 has since merged, and the branch is behind `main`. The merged tree is clean and green in my run (see below), but CI has only run on the old base.
- Merge or update `main` again so CI runs on the real base. Re-check that 0406 is still the next migration number at merge time.

## Verified (with evidence)

**Migration**
- `0406` sorts after `origin/main`'s latest migration (`0405_shop_alert_send_log`).
- Journal `idx` 398 follows 397, and `when` 1813320000000 is after 1813233600000. Both were confirmed in `drizzle.__drizzle_migrations` after `db:migrate`.
- `SET LOCAL lock_timeout = '30s'` is set.
- The new column is nullable with no default, so no row is rewritten.
- Nothing destructive happens going forward. The rollback deletes only notices of the new type, and it says so.

**Rollback**
- I migrated a fresh database through 0405 and a second one through 0406 followed by `0406_rollback.sql`. `pg_dump -s` of the two was identical apart from the dump's random `\restrict` token, and the ledger rows matched (397 / 1813233600000).
- The PR's own integration test passes. It applies over 0405 data, checks the reason rules (`23514`), rolls back, and applies again.

**Grants:** the 0406 probes pass for all four roles, and every probe fails when its grant is mutated:

| Grant mutation | Probe that fails |
| --- | --- |
| `revoke update on delivery_quote from api_app` | api_app 0406 probe |
| `revoke insert on domain_events from api_app` | api_app 0406 probe |
| `grant update (decline_reason) … to worker_app` | worker_app 0406 probe |
| `revoke select on delivery_quote from worker_app` | worker_app 0406 probe |
| `grant select on delivery_quote to shop_app` | shop_app 0406 probe |
| `grant select (decline_reason) … to auth_app` | auth_app 0406 probe |

`db:roles` restored the grants afterwards. Five older worker_app tests need seed data and fail on an unseeded database; that is not caused by this PR.

**Concurrency, on real Postgres:**
- Session 1 accepted a quoted quote and held its transaction open.
- Session 2, as `api_app`, ran the decline `UPDATE … WHERE status='quoted'`. It blocked, then updated 0 rows once session 1 committed.
- Final state: `accepted`, no reason. The row-level race is safe. F1 is about what staff *saw*, not about this race.

**State machine and authorisation**
- `decline` runs from `requested` and `quoted` only.
- Mutations that let it run from `accepted` or `withdrawn`, or by the buyer, are caught by the domain tests and, after rebuilding `@auction/domain`, by the service tests.
- Declining twice gives 409 with one notice. Declining an accepted, withdrawn or missing quote sends no notice.
- Only Fulfilment and Administrators are allowed, checked across every staff role. Money is untouched: an accepted quote cannot be declined, and `amount` is left alone.

**Mutations killed**

| Area | Mutations |
| --- | --- |
| Repository | status guard dropped; audit insert removed; reason added to the event payload; `UPDATE` outside the transaction; no transaction |
| Service and notifier | notice on a failed decline; no notice; notice twice; non-stable notice key; full error logged |
| Route and validators | idempotency guard removed; `.strict()` removed; `.trim()` removed (validators rebuilt); `no-store` removed |
| Read model | history naming the buyer for a decline |

**Notice:** sent once per quote (key `delivery-quote-declined:<quoteId>`), after commit, best effort. It cannot be muted (D8: it is a decision), uses the `lot-fulfilment-update` template, and React escapes the reason. The log on failure carries only the ids and the error name.

**PII:** the domain event payload is ids plus `fromStatus`. It is in the PII allowlist and the catalogue, and the integration test asserts there is no reason or address in it.

**Gates on the merged tree**
- Typecheck passes for api, web, persistence, shop-api and worker.
- Test results:

| Suite | Result |
| --- | --- |
| apps/api (changed areas) | 283 tests pass |
| persistence: decline and admin-deliveries | 13 pass |
| domain | 52 pass |
| shop-api: delivery-quote | 48 pass |
| web: notifications and labels | 73 pass |
| types | 337 pass |

- `lint:layers`, `lint:deps` (no new circular dependencies), `lint:admin-capability-drift`, `lint:z-schema-transform`, `lint:test-mocks`, `lint:datetime` and `biome check` all pass.
- No route-JS budget or baseline files were changed.
- CI on `f8a698a2`: 40 success, 1 skipped, 0 failed.

**Commits and PR body**
- All 4 commits are by `mahmoudamrspace <mahmoudamr.space@gmail.com>` with no trailers.
- The PR body has no AI footer.
