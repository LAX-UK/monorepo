Verdict: FIX FIRST

# Review of PR #1483: alerts/digest-covers-in-app-engine-link (head 79c397f2)

An independent review against the alert engine (`packages/alerts`), the existing notification preference model
(`packages/persistence/src/lib/notification-preference-keys.ts`, `apps/web/src/lib/notifications/alert-matrix.ts`) and
`docs/design`. Note that `docs/design` holds only `motion.md`, `staff-design-standard.md` and `storage-terms.md`. There is
no approved alert or notification design there, so "approved design" here means the behaviour already shipped in #911,
#928, #931 and #950. File:line references are to the PR head.

## Blocking

1. **CI is red: the shared contract change breaks lax.art.** BLOCKING.
   `packages/shop-contracts/src/release-alerts-public.ts:79` adds a *required* `topic` field to
   `ReleaseAlertUnsubscribePreviewSchema`. lax.art parses the same preview, and `apps/art` was not updated.
   CI job `test` (run 43798536357) fails with
   `apps/art/src/lib/alerts/art-email-alerts.server.test.ts > reads the preview with the token alone`:
   `expected { status: 'failed' } to deeply equal { status: 'ok', … }`. I reproduced this locally, and `ci-result` is failure.
   Beyond the test, this is a deploy-skew hazard: an `apps/art` or `apps/shop` build that has the new contract but talks
   to a shop-api without it rejects every preview, so the stop page shows "failed". The same happens in reverse during a
   rolling deploy. Fix: make `topic` `Type.Optional(...)` (and treat it as absent = null in readers), then update the art
   fixture and test.

2. **Existing users who turned an artist or saved-search email off will start getting in-app notices.** BLOCKING
   (backwards compatibility).
   Before this PR, the app notice for `bid.artists` and `bid.searches` was built from the email. Settings showed the
   App switch as *off and locked* ("Comes with the email") whenever the email was off (removed lines in
   `apps/web/src/lib/notifications/alert-matrix.ts` near `:149`). The stored `artist_alerts_in_app` and
   `search_alerts_in_app` columns default to `true` and were never meaningful while the email was off, so every
   existing person with the email off has `true` stored.
   `packages/persistence/src/repositories/bid-alerts/bid-alert-watchers.ts:52` and `:78` now match on
   `emailOn OR COALESCE(<in_app>, true)`, and `packages/alerts/src/application/digest-run.ts:199-219` writes the notice
   for those topics.
   Result: on deploy, everyone who switched these emails off starts getting artist and saved-search notices in the
   app. Their Settings App switch also flips from "off" to "on" without them touching it. That is exactly the
   "someone suddenly gets notices they turned off" case.
   Fix: in the migration, backfill `artist_alerts_in_app = false` and `search_alerts_in_app = false` for people whose
   `bid.artists` / `bid.searches` topic has `email_on = false` (or who have a stopped subscriber). Keep the rollback in
   step, and add a migration or integration test proving that an existing email-off person gets no notice after the
   upgrade. A person with *no* `notification_preference` row also goes through `COALESCE(…, true)`, so cover that case
   too.

3. **A fresh "Notify me" is silently dropped forever after any earlier stop.** BLOCKING (regression).
   `apps/shop-api/src/infrastructure/alerts/back-in-stock-links.ts:68-79` reports `stopped` when the engine subscriber is
   `stopped` (for example after an "all Shop alerts" stop from a *release* alert email) or when `shop.back_in_stock` has
   `email_on = false`. `apps/shop-api/src/infrastructure/shop-notify-me-dispatch.ts:98` then cancels the request
   without emailing. Nothing turns the topic back on when the person presses Notify me again. The only `setEmail` call
   runs when the topic row is missing (`:69`). So:
   - someone who once stopped back-in-stock can never get a back-in-stock email again, although the storefront still
     says "We'll email you";
   - someone who stopped *release alerts* with the all-alerts link loses back-in-stock emails they explicitly asked
     for afterwards. Before this PR each request carried its own token and was unaffected.
   Fix: a new Notify me press is fresh consent. It should re-enable the topic (and re-confirm or create a topic-scoped
   record) at request time. Alternatively, dispatch should compare the stop time with the request's `created_at` and
   only suppress requests made *before* the stop. Add a test for "stop, then press Notify me again, then the email is
   sent".

4. **Screenshot evidence is wrong or missing for the UI.** BLOCKING (evidence).
   The two "dark" files are byte-identical to the "light" ones:
   `docs/pr-evidence/alerts-digest-covers/back-in-stock-375-dark.png` and `…-375-light.png` have the same SHA-256
   (`57bb9df0…`), and `digest-cover-375-dark.png` and `…-375-light.png` match too (`43fb15f6…`). So no dark-scheme render
   was captured, although the PR text says one was. The changed preferences screen (the Settings "Where alerts reach
   you" matrix with the two new rows and the removed lock, plus Watching's "app only") and the Shop stop page have no
   screenshots at all. Needed: Settings alerts matrix and Shop `/release-alerts/stop` (back-in-stock variant), each in
   light, dark and 375px, plus a real dark-mode-client render of the two emails.

## Should fix (non-blocking)

5. **Migration number collision with #1482.** `packages/db/drizzle/0398_notice_delivery_preferences.sql`,
   `0398_rollback.sql`, `meta/_journal.json:2729` (idx 390) and `packages/db/src/migration-0398-notice-delivery-preferences.test.ts`.
   PR #1482 adds `0398_demo_seed_target.sql`, its own `0398_rollback.sql` and the same journal idx, and it merges first.
   After it lands, renumber this PR to 0399 (journal idx 391, `when` above #1482's) and rename the SQL, the rollback
   and the test (`TAG`, the "after 0397" assertion, and the rollback's `created_at` ledger delete at the bottom of
   `0398_rollback.sql`). Not blocking on its own.

6. **GET on an old cancel link now writes rows.** `apps/shop/src/app/alerts/unsubscribe/route.ts:10-14`. The comment
   still says "Nothing changes on GET, because mail scanners open links". But GET calls
   `/v1/alerts/unsubscribe/engine-link`, which goes through
   `apps/shop-api/src/application/handlers/edition-alerts.handler.ts:53-62` and then `linkFor`. `linkFor` can *create* an
   engine subscriber (confirmed for an account, pending for a guest) with the consent text "You pressed Notify me…" and
   turn `shop.back_in_stock` on. A mail scanner opening an old *unsubscribe* link therefore records consent evidence.
   Prefer a read-only lookup on GET: mint a stop token only for an existing engine row, and otherwise fall back to the
   old `/alerts/stop` page. Security otherwise looks fine:
   - the redirect target is a fixed same-origin path (no open redirect);
   - the old token is pattern-checked before the call and looked up server-side by hash;
   - the engine token is HMAC-signed, scoped to `subscriberId` and `topic`, and verified by the codec;
   - the response is `no-store`;
   - no email address or id appears in any URL.

7. **Identity-check outcome emails become optional.** `apps/api/src/services/kyc/kyc-notice-queue.ts:51-56`
   (`category: "transactional"`). With both Identity switches off, a declined person gets nothing, and the decline
   email carries the retry and contact steps. Defaults keep current behaviour, so this is not a regression, but please
   confirm with compliance that a KYC *decline* may be fully muted. If not, lock the decline email on the way the
   documents re-request already is.

8. **Registration and limit notices have no idempotency.**
   `apps/worker/src/projectors/notification-fanout/bidding-registration-fanout.ts:94,131,172`. The emails are deduped by
   `idempotencyKey`, but `createMany` notices are not. A projector retry duplicates the notice, and in the organisation
   loop a failure on member N re-notifies members 1 to N-1. This matches the existing fanout pattern, but the new types
   would benefit from a dedupe key (event id + user) or a unique index like `notification_alert_digest_type_uid`.

9. **The cover image goes through `/_next/image`.** `apps/worker/src/alerts/cover-image.ts:28`.
   - Next negotiates the format from `Accept`, so a CDN that ignores `Vary: Accept` can hand WebP or AVIF to Outlook
     desktop. Pin a format (for example a pre-rendered 640px JPEG variant) or confirm that the CDN varies on Accept.
   - Absolute `https?://` keys must also be in `images.remotePatterns`, or the email shows a broken frame.
   Alt text, the 532px width with `max-width:100%`, `color-scheme: light` and the paper frame are good. Sender and legal
   entity are unchanged and correct (Bid: London Auction Xchange LTD; Shop: London Art Exchange Ltd).

10. **Minor.**
    - `DigestRun` calls `wantedTopics` twice per digest (`digest-run.ts:153` and `:199`), so two topic and preference
      reads. Pass the first result into `deliver`.
    - `0398` rebuilds `notification_type_check` without `NOT VALID` plus `VALIDATE`, which scans `notification` under an
      ACCESS EXCLUSIVE lock. That matches 0392 and 0299, so it follows precedent, but it is worth adopting as the table
      grows.
    - The rollback deletes delivered registration and limit notices. This is documented, and acceptable.
    - `migration-0398-…test.ts` is text-only. The forward, rollback and forward cycle is covered by
      `verify-migration-pairs` in CI and by my local run below.
    - The new row labels ("Identity check", "Registrations and limits") are inline in `alert-matrix.ts:98-108`, like
      the existing rows. `lint:client-copy` passes.

## Checked and fine

- **Default values:** the three new columns are `boolean DEFAULT true NOT NULL`, so identity and registration delivery
  is unchanged for everyone until they choose otherwise. `PreferenceAwareNotificationWriter` governs only the two new
  types, so no other notice changes.
- **Old back-in-stock links:** the redirect works, falls back to the old page when it cannot be moved, and old one-click
  POST still works. Tokens are signed, there is no IDOR (an engine stop token is only issued in exchange for a valid
  old token), and there is no open redirect.
- **Retired templates:** `shop-release-alert` and `shop-release-alert-confirm` are *kept*, which is correct while
  queued outbox rows cannot be ruled out. Run the outbox count from the PR before removing them later.
- **Grants (local `db:roles` plus `has_column_privilege` probes on Postgres 16):**
  - `api_app`: SELECT, INSERT and UPDATE on the new columns, the same as the existing preference columns.
  - `worker_app`: SELECT only, plus DELETE on the table for anonymisation, as before.
  - `shop_app` and `auth_app`: no access.
  - Least privilege is unchanged. `worker-store-role-contract` passes (330/330) with the real `worker_app` role and
    the new `BidAlertInAppTopics` store.
- **Layering:** the new `InAppTopicLookup` port sits in `packages/alerts`, with an adapter in persistence. The
  preference writer is a decorator wired in the worker container. `lint:layers` passes.
- **Route JS:** the CI build table shows every web, shop and art group "ok" and the tracked routes under their ratchet.
  The only over-budget group is `apps/account` (warn mode), which this PR does not touch. `budgets.json` is unchanged.
- **Attribution:** the commit message (one commit, author mahmoudamrspace) and the PR title and body contain no
  `Co-Authored-By`, `Claude-Session` or "generated by" lines. The body ends with a bare `---`, which is harmless.

## What I ran (head 79c397f2, local Postgres 16)

- `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build`: ok.
- `db:migrate`, `db:roles` and `verify-migration-pairs`: ok. I ran `0398_rollback.sql` (columns gone), then
  `db:migrate` again (columns back), then `db:roles` again: ok.
- Tests (`--maxWorkers=2`):

  | Scope | Result |
  |---|---|
  | alerts | 100/100 |
  | db (0398, 0392, 0299, role tests) | 86 passed |
  | email | 252/252 |
  | persistence (unit and bid-alerts integration) | 86 + 34 |
  | worker (alerts, fanout) | 91 passed |
  | worker role contract | 330/330 |
  | shop-api (alerts, edition, release, notify-me, scheduler, stock) | 150/150 |
  | api (kyc, categories, webhook) | 153/153 |
  | shop | 11/11 |
  | web (notifications, watching, settings) | 123/123 |
  | domain mutes | 38/38 |
  | **art alerts** | **1 failed (finding 1)** |

- Typecheck: alerts, persistence, email, db, worker, shop-api, api, shop, art and web are clean. Web needs
  `@auction/api` built first.
- `biome ci` on the changed files, `lint:client-copy` and `lint:layers`: clean.
- `gh pr checks 1483` (read through the REST check-runs API): `test` and `ci-result` fail; everything else passes or is
  skipped.
