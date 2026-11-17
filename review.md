Verdict: FIX FIRST

Independent review of PR #1519 "Add the release-alert send log read for LAX Admin" (head 99ea16f1, base 83b2420c) against `docs/design/staff-gaps-delivery-zoho-alerts.md` section 3 (LA-3, L1-L6, Q8-Q10) on origin/main.

The read itself is sound and in scope. The blocker is narrow: two of the claims in the PR's test evidence are not true of the tests, and I proved it with mutations. Both fixes are a few lines of test code.

## What I checked and found to be fine

- **Scope.** Read-side only. Contract, port, pure status rule, Drizzle store, route and wiring. There is no UI, no `apps/shop-admin` or `apps/web` change, no route JS change, no budget, baseline or allowance file, and no migration.
- **L3 shape.** `GET /admin/v1/release-alerts/sends?cursor=&limit=` returns one row per announced edition release, newest first. The response contract is `additionalProperties: false` and has no subscriber field. Drop reasons are engine codes (`topic_off`, `not_subscribed`, stale reasons), not personal data. This meets Q9.
- **Statuses** match the L2 table: not_announced, queued (no `expanded_at`), sending, sent, and not_sent_yet (an unsent digest older than 24h, ranked above sending).
- **Counts.** matched, emailed (digest `sent_at` set and not dropped), notSent (dropped) and waiting (the remainder). Only `shop.releases` matches are counted. Drops only ever hit undigested matches (`digest-run.ts` `removeUnwanted` and `digestFor`), so the defensive `droppedReason IS NULL` on emailed is consistent.
- **Publisher** comes from the latest `publish_artwork` audit row at or before `announced_at`. Both rows use DB `defaultNow()` in the same transaction (`drizzle-artwork-catalogue.writer.ts:339-365`, `drizzle-shop-transaction-effects.ts:29`), so they are equal and `lte` holds. The announcement is unique per work (`onConflictDoNothing`), so a republish cannot replace the publisher. A mutation that removed `lte` failed the suite. `shop_user_profile.identity_subject_id` is the primary key, so the join cannot fan out.
- **Bounded, no N+1.** `limit` is 1 to 50 in the schema and clamped again in the store. A page costs 4 queries whatever its size, and the integration test asserts this at sizes 1 and 50.
- **Authorization.** `lead.read` is enforced. Removing `requireShopStaffCapability` failed 6 of 13 route tests.
- **Layering.** contract → application port and pure rule → infrastructure store → route. `shopEditionReleaseSql` is shared rather than copied.
- **Migration.** None in this PR, so there is nothing to renumber, grant or roll back. The deferral of the Q10 counts migration is discussed in finding 3.
- **CI.** All 41 check runs passed or were skipped, including `ci-result`, shop-api vitest 1-4/4 and shop-v1-phase-smoke (integration).
- **Commits** are authored by `mahmoudamrspace`. The commits and the PR body carry no AI footer or trailer.
- **Local runs.** Postgres 16 with `db:migrate` and `db:roles`, run as `shop_app`. Unit 5/5, route 13/13, contract 4/4 and integration 4/4 all pass. All of these fail on main, where the modules do not exist.

## Mutation results (store reverted piece by piece; integration suite rerun each time)

| Mutation | Result |
| --- | --- |
| drop `lte(audit.created_at, announced_at)` | fails (good) |
| drop `topic = 'shop.releases'` from counts | fails (good) |
| drop `shopEditionReleaseSql` filter | fails (good) |
| swap stuck/sending precedence (unit) | fails (good) |
| remove `lead.read` check (route) | fails (good) |
| **drop the `item_key` tie-breaker from the cursor predicate** | **passes: not covered** |
| **drop the 24h age test from `stuck`** | **passes: not covered** |
| drop `droppedReason IS NULL` from emailed | passes (unreachable in practice, see above) |

## Findings

1. **Blocking: the cursor tie test never puts a tie on a page boundary.** `apps/shop-api/src/infrastructure/alerts/release-alert-send-log.store.integration.test.ts:250`. The test is named "pages by cursor without skipping or repeating a release, ties included" and pages with `limit: 2`. The two tied releases (`sent` and `tie`, both at `ago(20h)`) are rows 1 and 2, so they land on the same page and the cursor never sits between them. I removed the `item_key` tie-breaker from `release-alert-send-log.store.ts:106-108`, so the predicate became `announced_at < cursor`, and the suite still passed. With `limit: 1` the same mutation fails, and the unmutated code passes.
   *Fix:* page with `limit: 1`, or keep `limit: 2` and add a third release at `ago(20h)` so a tie straddles the boundary. Then rerun the mutation to confirm it fails.

2. **Blocking: the 24h stuck threshold is untested, and with it the line between "Sending" and "Not sent yet".** The only unsent digest fixture is 30h old (`...integration.test.ts:85`). Deleting `AND d.created_at < stuckBefore` from `release-alert-send-log.store.ts:140` still passes. With that mutation every in-flight digest would read as "Not sent yet", which is exactly the false alarm the L2 Stuck rule exists to avoid.
   *Fix:* add a release whose match sits in an unsent digest made, for example, `ago(2 * HOUR)`, and assert `status: "sending"`, `waiting: 1`. Add one boundary case for a digest made just past 24h if you want the threshold pinned.

3. **Non-blocking, but the PR body understates it: counts can shrink well before 90 days, and pruned rows read as a confident "Sent".** Subscriber deletion cascades to `shop_alert_match` (`packages/persistence/src/repositories/alert-retention/alert-retention.store.ts:70-117`: the unconfirmed and stopped prune, and the erasure path). So `matched`, `emailed` and `notSent` for a release can drop at any time, not only after the 90-day match prune. A release whose matches are all gone reads `sent` with `matched: 0`, and nothing tells it apart from "matched nobody". This PR does not need to solve that, because no screen reads it yet. Deferring the Q10 migration to the next PR is reasonable, since the column is useless without its worker-side writer.
   *Fix:* (a) Correct the PR body's "Until then, a release older than the 90-day log retention…" sentence to say counts can also shrink when subscribers are pruned or erased. (b) Make the follow-up PR, the one that adds `emailed_count` and `dropped_count` with its rollback, grants, grant probe tests and the next free journal number on main at ship time, a hard prerequisite for the L1 UI PR, not "before or with". (c) In that PR, have the read prefer stored counts and add an integration case that prunes or erases a subscriber after settlement and asserts the counts hold.

4. **Non-blocking: every page scans the audit table, which has no retention.** `release-alert-send-log.store.ts:186-204`. The publishers query filters `shop_admin_audit` by `(target_type, action, target_id)`, but the only index is `shop_admin_audit_created_idx` (`packages/db/src/schema/shop-commerce.ts:1311`). The counts and reasons queries (`:144`, `:166`) also filter on `item_key` alone. The only match index containing it is `(subscriber_id, topic, item_key)`, which cannot be used without its leading column. The match table is bounded by retention. The audit table is not, so this is the one cost that grows with time.
   *Fix:* in the follow-up migration add `CREATE INDEX shop_admin_audit_target_idx ON shop_admin_audit (target_type, target_id, created_at DESC)` and `shop_alert_match (item_key, topic)`, with paired down-migrations. Attach an `EXPLAIN` to the PR.

5. **Minor: a release disappears from the log if the work's edition flags change later.** `release-alert-send-log.store.ts:122-123`. The listing filters on the work's current `sales_channel` and `eligible_for_edition_allocation`, not on what it was when announced. If staff later move a work off the edition track, its past send vanishes from history. It is rare, so it can be accepted for now.
   *Fix (later):* when the counts migration lands, also store `kind` on the announcement, or at least note this in the contract doc comment.

6. **Minor, layering: `pageOf` is imported from a sibling reader.** `release-alert-send-log.store.ts:23` imports it from `../drizzle-admin-work-lists.reader.js`, which couples this store to an unrelated reader module.
   *Fix:* move `pageOf` next to the cursor helpers (for example `admin-created-at-keyset.ts`) and import it from there in both places.

7. **Nit: the route casts the query by hand.** `apps/shop-api/src/routes/admin/v1/admin-release-alerts.routes.ts:51` uses `request.query as {...}`.
   *Fix:* use `app.get<{ Querystring: AdminReleaseAlertSendsQuery }>(...)` so the handler type follows the contract.

## To flip to SHIP

Fix findings 1 and 2: two small test changes, each confirmed by rerunning the mutation above so that it now fails. Then make the PR-body correction in 3(a). Findings 3(b) and 3(c), and 4 to 7, can go into the follow-up migration PR.
