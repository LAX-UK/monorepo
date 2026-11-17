Verdict: SHIP

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

## Final recheck

Rechecked head `6eaeef5d` (8 commits), merged locally with today's `origin/main` (`310c9417`, one commit past the PR's base, #1527). The merge is clean. The setup was a local Postgres 16, `db:migrate` and `db:roles`.

**Result: F1, F2, F3, F4, F6, F7 and F8 are resolved. F5 needed no change. Nothing blocks shipping.**

### Findings

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 decline tied to the quote staff saw | Fixed | See below |
| F2 dialog in the panel (D9 step 3) | Fixed, option (a) | See below |
| F3 audit in the same transaction | Fixed | See below |
| F4 two error shapes | Fixed | See below |
| F5 422 on a reused key | No change asked | Unchanged |
| F6 write guard untested | Fixed | See below |
| F7 NOT VALID comment | Fixed | See below |
| F8 PR body out of date | Fixed, with one cosmetic slip | See below |

**F1 — the decline is tied to the quote staff saw**
- The body is now strict: `{quoteId: uuid, expectedStatus: enum, reason: trim, 1-500}` (`packages/validators/src/admin-deliveries.ts`).
- `StaffDeliveryQuoteService.decline` returns `quote_changed` when `current.id !== quoteId` or `current.status !== expectedStatus`. It passes `expectedStatus` as the `from` state to `repo.decline`.
- New service tests:
  - "withdrawn and asked again while the dialog was open" (Lyon request seen, London request current) gives `quote_changed`. The London quote stays `requested` with no reason, and `quoteDeclined` is not called.
  - "priced by a colleague while the dialog was open" gives `quote_changed`. The quote stays `quoted` with no reason, and there is no notice.
- Mutations:

| Mutation | Result |
| --- | --- |
| The seen check removed entirely | The "asked again" test fails |
| Status check removed and `from = quote.status` | The "priced by a colleague" test fails |
| Only the status half of the check removed (`from` still `expectedStatus`) | Tests pass, and the behaviour is still correct, because the conditional update on `expectedStatus` refuses the write. The status check is defence in depth, not a gap. |

- On Postgres, the repository test "changes nothing and audits nothing when the quote moved on" covers the `from` guard.

**F2 — the dialog is in the panel**
- **Where it shows:** `DeclineDeliveryAction` sits in the `DetailPanel` footer. `canDeclineDelivery` allows it only for `waiting`+`requested` or `quoted`+`quoted`, and only when `canWork`. `canWork` is `DELIVERIES_ACCESS` (`deliveries/page.tsx:41`), so only the write roles see it. The server action calls `denyUnlessAdminCapability(DELIVERIES_ACCESS)` again.
- **The form:** `StaffFormDialog` with "Reason for the buyer". The field has `maxLength` 500, the hint "Up to 500 characters", and an inline error under the field ("Tell the buyer why you can't deliver") with focus going back to it.
- **Stale state:** on `quote_changed` or `quote_step_not_allowed`, the dialog shows a warning Notice ("This request changed while you had it open. Check it and try again. Nothing was sent to the buyer.") and the panel refreshes. The wording differs from D6 on purpose; the PR body's Decisions section says why. Other failures show a Notice in the dialog, not a toast.
- **After a decline:** the panel shows "Declined by LAX" as the badge and as an Activity step, plus "Reason given to the buyer". `declineReason` is in `admin-deliveries.schema.ts`, and the copy is in `deliveries-copy.ts`.
- **Screenshots:** all 16 PNGs are present at 1440×1000 and 375×812, light and dark. I looked at 1-dialog 1440 light, 2-reason-missing 375 light, 3-stale 1440 light and dark, 3-stale 375 dark, and 4-declined 1440 dark. They render the states the README describes, with no sideways scroll at 375.
- **e2e in CI:** the spec is `apps/web/e2e/admin-deliveries-decline.spec.ts`, tagged `@smoke @journey` with `retries: 0`, and it has no skip path.
  - In the browser-gates job (133999600758), the `--list` step at line 723 lists `[staff-chromium] › admin-deliveries-decline.spec.ts:189:3 › deliveries: can't deliver @smoke @journey › declines a buyer's request with a reason, and refuses a request that changed`.
  - That job checked out `HEAD is now at 284dd0ed Merge 6eaeef5d… into 2646590a…`.
  - The run that includes it was `playwright test --grep "@smoke|@roles" --no-deps --workers=1`: "Running 92 tests", ending "6 skipped / 86 passed (6.6m)" with no failed and no retries.
  - The run uses the dot reporter, so the log has no per-test line. Because the spec cannot skip, 0 failed means it passed.
- **Local tests:** web deliveries, notifications and labels: 16 files and 169 tests pass. `staff-form-dialog` passes 2 tests.

**F3 — the audit is written in the same transaction**
- The new repository test makes the transaction fail at commit with a `DEFERRABLE INITIALLY DEFERRED` constraint trigger on `delivery_quote`, after the audit insert. It then asserts the quote is still `requested` and that no `delivery_quote.declined` row exists.
- All 4 repository integration tests pass on Postgres 16.
- With `tx.insert(domainEvent)` mutated to `this.db.insert(domainEvent)`, the new test fails ("expected [ { id: 7, … } ] to have a length of +0 but got 1"), and the 3 others pass. The trigger and function are dropped in `finally`, and none was left on the database afterwards.

**F4 — both error shapes**
- Both shapes are documented in the PR body and in the route's comment.
- A route test asserts the 422 body `{error: "This Idempotency-Key was already used for a different request", code: "idempotency_key_reuse"}`.
- The web server action reads `code` first, then `error`.
- With the idempotency guard removed, the idempotency test fails.

**F6 — read-only guard**
- With the read guard open to everyone, a `read_only` POST gets 403 and the service is not called.
- With `requireDeliveries` removed, that test fails.

**F7 — comment**
- The 0406 comment now says the split saves no lock time inside one transaction, and that the scan is short because the table is small.

**F8 — PR body**
- The body is current: base, scope, D9 step 3, both error shapes, a "Changes after review" section, and the migration-number note.
- One cosmetic slip: the `2-reason-missing` / 1440 light cell is malformed (`&lt;img src="`` https://… `` width="220">`). It shows as text, not the image, although the file exists at `b09283df`.

### Migration
- `0406_delivery_quote_decline` still sorts after `origin/main`'s latest migration (`0405_shop_alert_send_log`, journal `idx` 397).
- **The renumber is not needed today.** `main` has no 0406. If another migration lands first, the author must renumber at ship time. That is noted here and was not done by me.
- **Journal:** `idx` 398 and `when` 1813320000000, after 1813233600000. After `db:migrate`, `drizzle.__drizzle_migrations` has 398 rows, the newest `1813320000000`.
- **Rollback:**
  - I migrated database A through 0405 (0406 hidden from the journal temporarily, then restored), and database B through 0406 followed by `0406_rollback.sql`.
  - The `pg_dump -s` output of the two was identical once the `\restrict` lines were removed. Both ledgers had 397 rows, newest 1813233600000.
  - Running `db:migrate` again on B reapplied 0406 (398 rows, `decline_reason` back).
  - The PR's 0406 static and integration tests pass: 6 tests, covering apply over 0405, the reason rules, roll back, and apply again.
- **Grants:** the 0406 probes pass for `api_app`, `worker_app`, `shop_app` and `auth_app`. Each mutation fails exactly one probe, and `db:roles` restored all 4 to passing:

| Grant mutation | Probes failing |
| --- | --- |
| `revoke update on delivery_quote from api_app` | 1 |
| `revoke insert on domain_events from api_app` | 1 |
| `grant update (decline_reason) … to worker_app` | 1 |
| `grant select on delivery_quote to shop_app` | 1 |
| `grant select (decline_reason) … to auth_app` | 1 |

- `migration-0402-in-app-opt-outs.integration.test.ts` fails on an empty migration-test database ("relation notification does not exist"). The PR does not touch that file, and the failure comes from that test's setup expecting a migrated database.

### Gates on the merged tree

| Gate | Result |
| --- | --- |
| `turbo typecheck`: api, web, persistence, shop-api, worker, staff-ui, validators, domain | Pass (45 tasks) |
| `lint:layers`, `lint:deps` (no new circular dependencies), `lint:admin-capability-drift`, `lint:z-schema-transform`, `lint:test-mocks`, `lint:datetime`, `lint:route-js-budget`, `lint:e2e-tags`, `lint:e2e-portfolio`, `lint:client-copy` | All exit 0 |
| `biome check` on the changed files | Exit 0 |
| apps/api: deliveries routes, organisation-buying, deliveries service | 275 pass, 7 skipped |
| domain: delivery-quote, notification-mutes | 52 pass |
| shop-api: tests matching "delivery" | 99 pass |
| CI on `6eaeef5d` | 40 success, 1 skipped (`art-browser-gates`), 0 failed |

### Hygiene
- No route-JS budget or baseline file, allowance, workflow, `playwright.config`, `budgets.json` or `scripts/` file changed.
- **No stray files.** Every changed path is under `apps/api/src`, `apps/web/src`, `apps/web/e2e`, `packages/`, `docs/design/` or `docs/pr-evidence/bid-admin-deliveries-decline/`, which follows the existing `docs/pr-evidence/*` convention. The only deletion is `delivery-quote-ready-notifier.ts`, replaced by `delivery-quote-notifier.ts`.
- All 8 commits are authored and committed by `mahmoudamrspace <mahmoudamr.space@gmail.com>` (`2646590a` is `main`'s squash merge). They have no Co-Authored-By, Signed-off-by or Claude trailers.
- The PR body has no AI footer.

### Non-blocking notes (fine to do after merge)
1. Fix the malformed `2-reason-missing` 1440 light image cell in the PR body.
2. `3-stale-375-dark.png` looks dimmed, with a low-contrast Notice, compared with `3-stale-1440-dark.png`. It may have been shot mid-transition. Worth re-shooting.
3. After a stale Notice the reason field is disabled, but "Decline and email the buyer" stays enabled. A second submit only gets `quote_changed` again, which is harmless, but it is better disabled or replaced by "Close".
4. `errors.unavailable` says "Nothing was sent to the buyer" when the fetch throws. A timeout after the API committed would make that untrue; "may not have been sent" is safer. A retry with the same key replays the stored answer, so no second email goes out.
