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

## Final recheck

Recheck of PR #1519 at head `237a1e05` (the fixer's commit `10c2ad77` "Keep release-alert send log counts, kind and publisher on the announcement", then a merge of `origin/main` at `5e8a086d` that pushed while this recheck ran; its tree matches my local merge of `10c2ad77` with main, except for whitespace in `_journal.json`, so every result below holds for the head), against findings 1 to 7 above and design section 3 (L1 to L6, Q8 to Q10). Everything below was run locally on Postgres 16 with `db:migrate` and `db:roles`, with the integration suites running as `shop_app`. Each mutation was applied to the PR code, the suite was rerun, and the code was restored.

### Findings 1 to 7: all fixed, each pinned by a test that fails without the fix

| # | Finding | What the PR does now | Mutation applied | Result |
| --- | --- | --- | --- | --- |
| 1 | Cursor tie never on a page boundary | Three releases (`sent`, `tie`, `tie2`) share one instant as rows 1 to 3. The test asserts this, then pages at `limit` 1 and 2 and requires exactly the unpaged order: no skip, no repeat, no page over the limit (`...store.integration.test.ts:282`) | predicate `(announced_at, item_key) < cursor` cut to `announced_at < cursor` | 1 failed (the tie test) |
| 2 | 24h stuck threshold untested | Digests unsent 23h and 25h: `sending` and `not_sent_yet`, both `waiting: 1` (`:301`) | delete `AND d.created_at < stuckBefore` | 1 failed (23h case) |
| | | | force `stuck: false` | 2 failed (25h case and main listing) |
| 3 | Shrinking counts read as a confident "Sent" | Counts kept on `shop_alert_announcement` (Q10), written in the same statement as `markExpanded`, `markSent` and `drop`. A match whose subscriber was removed reads as not sent, with reason `removed_before_sending`. Rows from before 0405 read `countsKept: false` and `counts_not_kept`, never `sent` | ignore kept counts (always live) | 3 failed |
| | | | report old rows as kept | 2 failed |
| | | | skip the `removed_before_sending` reason | 1 failed |
| | | | no `matched_count` on expansion | 7 failed |
| | | | drop the `sent_at IS NULL` "once" guard in `markSent` | 1 failed |
| | | | drop the `dropped_reason IS NULL` "once" guard in `drop` | 1 failed |
| | | | drop the topic filter in `drop` / in `markSent` | 3 failed / 3 failed |
| 4 | Audit table scanned per page | `announced_by` written at publish, backfilled once in the migration. The page joins `shop_user_profile` by primary key. The test asserts 2 queries at sizes 1 and 50, and that no query mentions `shop_admin_audit` | add an audit query per page | 2 failed |
| | | | stop writing `announced_by` at publish | 1 failed |
| 5 | Release vanishes when flags change | Listed by `kind` kept at publish. Tests move a work to `art`/non-edition (it stays) and keep an `art_original` with edition-looking flags (it stays out) | filter by current flags | 2 failed |
| | | | stop writing `kind` at publish | 2 failed |
| 6 | `pageOf` imported from a sibling reader | Moved to `admin-created-at-keyset.ts` with its own unit test. Work-lists, people-lists and the send log all import it from there | structural (checked by reading) | OK |
| 7 | Hand cast on the query | `app.get<{ Querystring: AdminReleaseAlertSendsQuery }>` with `querystring: AdminReleaseAlertSendsQuerySchema` (Fastify validates it at runtime: the route tests get 400 for `limit` over 50 and for a bad cursor). `tsc --noEmit` is clean | type-only | OK |

Shrinking counts, checked directly: the test "hold after the matches are pruned and their subscribers deleted" deletes every match and every subscriber of a settled release, and the row is unchanged (`sent`, matched 5, emailed 2, not sent 3). "count a subscriber removed before sending" deletes a waiting subscriber and gets `removed_before_sending: 1`. A pre-0405 pruned release reads `counts_not_kept`, never `sent`. The PR body's "Counts" section describes this accurately, including the deploy-overlap caveat.

### Migration 0405

- **Number.** 0405 (`idx` 397, `when` 1813233600000) sorts after main's `0404_artwork_stock_location` (`idx` 396, `when` 1813147200000). 0404 touches no table that 0405 uses. The PR body's renumber note ("number provisional ... renumbered at ship time if needed") is present. 0405 is correct as it stands, so no renumber is needed.
- **Merge with main.** At `10c2ad77`, GitHub reported `mergeable_state: dirty`. The only conflict was `packages/db/drizzle/meta/_journal.json`. The head `237a1e05` resolves it to 0404 (idx 396) then 0405 (idx 397), and GitHub now reports `blocked` (awaiting review), not `dirty`. On that tree, `db:migrate` on a fresh database applied 397 entries, and `db:verify-migration-pair` verified both `0404_artwork_stock_location` and `0405_shop_alert_send_log`. These all pass: the 0405 unit and integration migration tests (the "is the last journal entry" check still holds), the role contract (21/21 with the migration tests), the send-log and catalogue integration suites with the route tests (30/30), and `tsc --noEmit`.
- **Rollback.** `0405_rollback.sql` drops the index, both checks and the six columns, and deletes its own ledger row (`created_at = 1813233600000`). The integration test rolls back and reapplies.
- **Grants.** No new grants. The new columns inherit `shop_app`-only table grants. The probe checks SELECT, INSERT and UPDATE on each column for `shop_app` (true) and `api_app`, `worker_app` and `auth_app` (false). To prove the probe works, I temporarily granted `api_app` SELECT on `kind`: the probe failed with `api_app kind:SELECT: expected true to be false`. Then I revoked the grant.
- **Defaults** are set after `ADD COLUMN`, so old rows keep NULL counters (the integration test checks this). The `lock_timeout` is 30s. The `(item_key, topic)` index is plain, as in 0321.

### Other checks

- **Counts only.** The contract has `additionalProperties: false` and no subscriber field. "never carries a subscriber's address" passes. `publishedByName` is the staff publisher, which L2 asks for.
- **Scope.** No `apps/web`, `apps/shop` or `apps/shop-admin` change, so route JS has not grown. No budget, baseline or allowance file is touched.
- **Commits.** All 5 (including the merge `237a1e05`) are authored by `mahmoudamrspace <mahmoudamr.space@gmail.com>`, with no trailers.
- **Design.** The L3 recommendation was to read the publisher from the audit row. The PR uses the L3 alternative (`announced_by`), which finding 4 asked for. It rides on the Q10 migration (decided "Yes"), so it is in scope.

### New findings

A. **Blocking: the PR body ends with an AI footer.** The last lines of the description are `---` and `_Generated by [Claude Code](https://claude.ai/code)_`. That breaks the no-AI-footer rule. Remove them from the PR description.

B. **Resolved during this recheck: the journal conflict with main.** `237a1e05` merges main with a normal merge commit, with 0404 then 0405. See the migration section.

C. **Should fix, test evidence overstated: 3 of the 6 topic filters are not covered.** The PR body says that mutations which "drop the topic filters each fail the suite". These still pass 15/15 (or 30/30):
   - removing `topic = 'shop.releases'` from `matched_count` in `markExpanded` (`shop-alert-ledgers.ts`). The other-topic fixture matches are inserted after `markExpanded`, so they never reach the count.
   - removing `eq(m.topic, RELEASE_TOPIC)` from `liveCounts` (`release-alert-send-log.store.ts:217`). The other-topic fixtures are one emailed and one dropped, never waiting, so `waiting` and `stuck` don't change. A waiting back-in-stock match on a restocked edition would turn a finished release back to "Sending" or "Not sent yet".
   - removing the topic filter from the pre-0405 `dropReasons` query (`:245`).

   *Fix:* in the "sending" fixture, insert the `shop.back_in_stock` matches before `markExpanded`. Add one waiting other-topic match, ideally in a digest unsent for more than 24h, to a release that is otherwise `sent`, and assert it stays `sent` with `waiting: 0`. Give a legacy row an other-topic dropped match. Rerun the three mutations. Alternatively, correct the PR body's claim.

D. **Minor, not blocking: a release published during the deploy overlap never appears in the log.** The running release inserts announcements without `kind`. Once 0405 is applied, its one-off `kind` backfill has already run, so a work published by the old release in that window keeps `kind = NULL` and `eq(kind, 'shop_release')` hides it permanently. The same goes for its `announced_by`. The PR body describes only the uncounted-digest side of the overlap. *Fix (pick one):* read `kind IS NULL` rows through the current-flags rule as a fallback, or add a line to the PR body and the migration comment saying an overlap publish needs the backfill `UPDATE` rerun.

E. **Nit:** the `Math.max(matched_count, emailed + dropped + waiting)` guard in `keptCounts` is untested (the mutation passes). It is defensive, so nothing is needed beyond awareness.

### CI on head `237a1e05`

Finished on head `237a1e05`: 41 check runs, 40 `success` and 1 `skipped` (`art-browser-gates`, path-filtered). None failed. These include `ci-result`, `test`, `build`, `static-checks`, shop-api vitest 1-4/4, api vitest 1-2/2, web vitest 1-8/8, all four `shop-v1-phase-smoke` jobs (contracts, integration, admin-routes, shop-build), `worker-role-contract`, `auth-role-contract`, `browser-gates` and `account-browser-gates`.

### To flip to SHIP

Do A (remove the footer from the PR description) and C (three small test changes, each confirmed by rerunning its mutation). D can be a one-line PR-body note. Findings 1 to 7 need nothing more.

### Independent confirmation (second run, same head `237a1e05`)

I ran a separate pass on a fresh Postgres 16 with `db:migrate` and `db:roles`, using `shop_app`. It agrees with the verdict above.

- **Blocker A** is confirmed: the PR description still ends with the AI footer.
- **Finding C** is confirmed for `markExpanded`: removing its topic filter still passes all 15 send-log integration tests. I did not rerun the `liveCounts` and `dropReasons` mutations.

These mutations were not run above. Each one fails the relevant suite:
- stuck threshold moved to 22h, and to 26h
- `counts_not_kept` collapsed to `sent`
- removed-before-sending left out of `notSent`
- migration: the counter default put on `ADD COLUMN`
- rollback: the `kind` column left in place
- migration: the counts check removed
- route: the querystring schema removed (2 route tests fail)
- grant probe: `shop_app` UPDATE revoked (the probe fails with `shop_app kind:UPDATE: expected false to be true`; restored with `db:roles`)
