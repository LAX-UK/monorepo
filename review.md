Verdict: SHIP

# Final recheck of PR #1483 (head ea7ad9a0)

This is an independent recheck of the fixes listed under "Changes after review" in the PR body, against the earlier
review (7b4297bc on this branch). File:line references are to head `ea7ad9a0`. I did not change the PR branch.

**Condition for shipping.** CI has not run on any of the fix commits. GitHub reports `mergeable_state: dirty`,
and the head has no check runs. The last CI run (43798536357) was on the original commit 79c397f2. The only
conflicts with `origin/main` are `packages/db/drizzle/0399_rollback.sql` and `meta/_journal.json`. They come from
the migration number, because main now holds 0399/0400 and 0401 is taken. As instructed, the number does not
block, and I ran every relevant suite locally (below), all green. CI must still be green after the ship-time
renumber before this merges.

## Blocking

None.

## Non-blocking

1. **The ship-time renumber has to touch five places.**
   - The SQL and rollback file names.
   - The journal `idx`/`when`. Its `when` must be later than main's last entry.
   - The ledger delete in the rollback: `0399_rollback.sql:243` deletes `created_at = 1812715200000`. It must match
     the new `when`, or a rollback leaves the ledger row behind and the migration is never reapplied.
   - The `TAG` and journal-order assertion in `migration-0399-notice-delivery-preferences.test.ts`.
   - The file name of `migration-0399-in-app-opt-outs.integration.test.ts`.
2. **`verify-migration-pairs` does not cover this migration.** `scripts/ci/verify-migration-pairs.mjs:10-32` only
   probes 0137–0161. The PR body lists it as a check, but the forward, rollback and forward cycle is proven only by
   `migration-0399-in-app-opt-outs.integration.test.ts:209` and by my manual run below.
3. **Plain `CREATE UNIQUE INDEX` on `notification`.** `0399_notice_delivery_preferences.sql:28` takes a SHARE lock,
   and inserts wait while it scans the whole table, even though every `dedupe_key` is NULL. This follows the
   0297/0316/0365/0384 precedent, and `lock_timeout` is 30s. Consider adding the same pre-deploy
   `CREATE INDEX CONCURRENTLY` note that main's `0399_domain_events_event_type_aggregate_idx.sql` carries.
4. **Backfill side effect on a later re-subscribe.** The backfill turns the app switch off for people whose Bid
   alerts are *stopped* (`0399_notice_delivery_preferences.sql:45-48`). If such a person signs up again later,
   the email resumes but the artist and saved-search app notices do not until they turn the switch on. Before
   this release the notice came with the email. This is the conservative direction (nobody gets a notice they
   turned off), so it is acceptable. It is worth a line in the release notes or support macro.
5. **The rollback comment overstates one case.** It says it keeps "a switch the person chose themselves"
   (`0399_rollback.sql:135-138`, test name at `:209`). A person whose email is off, and who turned the app switch
   off themselves after the release, is switched back on. That is harmless, because the previous release does not
   read that switch while the email is off. Only the wording is off.
6. **The two sides of the Notify me comparison come from different clocks.**
   - `requestedAt` is the interest row's `updated_at`, written by the database's `now()`
     (`drizzle-edition-alert.store.ts:125`).
   - The stop times come from the app clock (`subscriber.stopped_at`, `topic.changed_at`), and they are compared
     at `back-in-stock-links.ts:114`.
   Skew of a few milliseconds could misorder a press made at the same instant as a stop. That risk is negligible.
   Using one clock would remove it.
7. **The email cover copy is keyed only on the source key.** See `apps/worker/src/alerts/cover-image.ts:15,73`.
   - If an original is ever overwritten at the same key, the stale 640px copy stays.
   - Also, `storageKeyOf` (`:23-29`) accepts any stored key in the upload bucket, which also holds Source-of-Funds
     uploads. Only staff set cover values, and the copy lands beside its original (same prefix, same access), so
     nothing is exposed.
   Restricting source keys to the public media prefixes would be tidier.
8. **The KYC app-switch read is outside the transaction.** `kyc-notice-queue.ts:52` reads through the shared
   reader, not `tx`. This is harmless for a single read.
9. **One screenshot is mislabelled.** `digest-cover-375-dark-inverted-no-picture.png` is 1264px wide at 2x, so it
   was rendered at about 632px, not 375. Its 1440 sibling and the 375 picture variant are correct.

## Verified (earlier findings)

1. **lax.art and the shared contract: fixed.**
   - `topic` is `Type.Optional(...)` at `packages/shop-contracts/src/release-alerts-public.ts:82`.
   - The new `release-alerts-public.test.ts` covers the old shape, the new shapes and an unknown topic.
   - The art alert tests pass (5/5), and shop-contracts passes 111/111.
2. **Existing email opt-outs carry over to the app: fixed.**
   - The backfill (`0399_notice_delivery_preferences.sql:31-60`) uses the same per-user rule the old reader
     implied: stopped or email off, unless another *confirmed* address still had the email on. It inserts a row
     for people without one, and on conflict it only ANDs a switch down.
   - Readers: `bid-alert-watchers.ts:52,78` (`emailOn OR COALESCE(in_app,true)`) and `BidAlertInAppTopics`
     (`bid-alert-lot-notice.writer.ts:55-68`).
   - The migration integration test (`:180,:189,:203,:209`) proves nobody whose email was off gets a notice, that
     the step is idempotent, and that rollback works. `bid-alert-lots.integration.test.ts` covers the with-row and
     no-row cases against the real readers.
   - Stopped subscribers are still dropped before any notice (`digest-run.ts:150-157`). New-sale notices are
     unaffected, because `BidDigestNotices` only writes artist and search notices.
3. **Notify me after a stop: fixed.**
   - A stop now covers only requests made before it (`back-in-stock-links.ts:106-114`,
     `back-in-stock-stop-times.ts`).
   - Pressing Notify me again moves `updated_at` forward (`drizzle-edition-alert.store.ts:119-128`).
   - Dispatch closes only stale requests (`shop-notify-me-dispatch.ts:44,80,105`).
   - A complaint still suppresses. Bounces stay suppressed by the outbox suppression list
     (`packages/email/src/suppression-policy.ts`).
   - Integration coverage is at `drizzle-edition-alert.integration.test.ts:346-390`: a new edition and one already
     waiting, a pre-stop request still closed, and release alerts not restarted.
   - A topic-scoped one-click POST stops only `shop.back_in_stock` and cancels waiting requests
     (`shop-alerts.handler.ts:161-171`). Shop's `oneClick` URL equals `stop`, and
     `/release-alerts/unsubscribe` handles POST, so the List-Unsubscribe header from `unsubscribeUrl` works.
4. **Screenshots: fixed.**
   - All 30 files have distinct SHA-256 hashes.
   - Bid Settings, Watching ("app only") and the Shop stop page (confirm and stopped) are each in 1440 and 375,
     light and dark.
   - I viewed `bid-settings-alerts-375-dark.png`. The Identity check and Registrations and limits rows show the
     email held on with a lock, and the app switch is independent.
   - Emails are light-only by design, and the forced-dark and inverted renders are included.
5. **Migration number:** waived, as instructed (see non-blocking 1).
6. **GET on old links no longer writes: fixed.** `existingStopToken` only reads (`back-in-stock-links.ts:81-84`),
   and `engineStopToken` (`edition-alerts.handler.ts:55`) returns 404 when the person has no engine row. The Shop
   GET route falls back to `/alerts/stop` (`apps/shop/src/app/alerts/unsubscribe/route.ts:15-25`), and
   `route.test.ts:23` asserts a single read-only lookup. The redirect stays same-origin and the response is
   `no-store`.
7. **KYC outcome email is mandatory: fixed.**
   - `identity_email` is gone everywhere.
   - `KycNoticeQueue` always queues the approval or decline email, and only the app notice follows
     `identityInApp` (`kyc-notice-queue.ts:49-84`).
   - Settings shows the email as held on.
   - Tests: the kyc unit and integration tests pass.
8. **Idempotent registration and limit notices: fixed.**
   - `notification.dedupe_key` has the partial unique index `notification_dedupe_key_uid`, and the writer uses
     `ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`
     (`drizzle-notification-write.repository.ts`).
   - The keys come from the email's idempotency key, which includes the event id and the person
     (`bidding-registration-fanout.ts:84`).
   - `ON CONFLICT DO NOTHING` needs only INSERT, and `worker_app` has INSERT and SELECT on `notification`.
   - `drizzle-notification-write.integration.test.ts` passes.
9. **Covers no longer use `/_next/image`: fixed.**
   - The worker renders a 640px baseline sRGB JPEG on white with sharp and stores it beside the original.
   - On any failure the digest goes without the picture, and the warning log carries only the error message, with
     no personal data.
   - `cover-image.test.ts` covers the key, the host, once-only rendering, failure, and the real sharp output.
10. **Minor items: fixed.**
    - One topic read per digest (`digest-run.ts:160,216`).
    - The `notification_type_check` rebuild is `NOT VALID` (`:130`).
    - The row labels and held-email reasons live in `apps/web/src/lib/notifications/alert-matrix-copy.ts`.
    - The stop-page wording lives in `apps/shop/src/lib/release-alerts/stop-copy.ts`.
    - `lint:client-copy` passes.

## Also checked

- **Digest coverage.** `deliver` builds the notice from in-app topics and the email from email-on topics, separately.
  A digest that is only notices is marked sent and counted as `noticeOnly`. Without the lookup port, the
  behaviour is the same as before. A resumed digest rereads its topics. Notice writes stay idempotent through
  `notification_alert_digest_type_uid`.
- **Preference enforcement is server side.**
  - The watchers' SQL and `BidAlertInAppTopics` gate artist and search notices.
  - `PreferenceAwareNotificationWriter` gates only `sale_registration_decided` and `bidding_limit_changed`. Other
    types pass through unchanged.
  - The registration and limit emails are always sent, as before.
- **Grants**, from `has_column_privilege` probes after `db:roles` on Postgres 16. `migrate-roles.ts` is unchanged,
  and the grants are table-level.

  | Role | `notification_preference.{identity,registration}_in_app` | `notification.dedupe_key` |
  |---|---|---|
  | `api_app` | S/I/U | S/I/U (table-level, as before) |
  | `worker_app` | S | S/I |
  | `shop_app` | none | none |
  | `auth_app` | none | none |

  `worker-store-role-contract` passes 330/330 with the real `worker_app` role.
- **Privacy.** No new logs carry an email address, a person id or a token. Old-link redirects put only signed
  tokens in URLs.
- **Layering.** The `InAppTopicLookup` and `BackInStockStopTimes` ports are defined where they are consumed, the
  writer decorator is composed in the containers, and `lint:layers` passes.
- **Attribution.** None of the PR commits have `Co-Authored-By`, `Claude-Session` or "generated by" trailers.

## What I ran (head ea7ad9a0, local Postgres 16)

- `pnpm install --frozen-lockfile`, a build of all packages, and a build of `@auction/api`.
- **Typecheck:** api, worker, web, shop, shop-api and art are clean.
- **DB setup:** `db:migrate` and `db:roles`. Then I ran `0399_rollback.sql`: the three columns were gone and the
  ledger row was deleted. `db:migrate` added them again and `db:roles` applied again. `verify-migration-pairs`
  passes (21 pairs, which do not include 0399).
- **Unit tests** (`--maxWorkers=2`):

  | Scope | Result |
  |---|---|
  | alerts | 101/101 |
  | shop-contracts | 111/111 |
  | email | 252/252 |
  | persistence lib | 122 passed, 20 skipped |
  | domain mutes | 38/38 |
  | db migration and role tests | 94 passed, 6 skipped |
  | worker alerts and fanout | 89/89 |
  | api kyc and subject-export | 292 passed, 10 skipped |
  | shop-api handlers, alerts and routes | 90 passed, 11 skipped |
  | shop alerts and release-alerts | 5/5 |
  | art alerts | 5/5 |
  | web notifications, watching, settings and dashboard notifications | 147/147 |

- **Integration tests:**

  | Scope | Result |
  |---|---|
  | db 0399, 0392 and 0299 (the 0399 opt-out test ran, not skipped) | 23/23 |
  | persistence bid-alerts, notification writer and lib | 180/180 |
  | shop-api edition alert, scheduler, returns stock and alert routes | 54/54 |
  | worker store role contract | 330/330 |
  | api kyc notice queue | 3/3 |

- `biome ci` on the 106 changed files, `lint:client-copy` and `lint:layers` are clean.
- **CI:** there are no check runs on ea7ad9a0, because the PR is unmergeable until the migration is renumbered. The
  last CI run (on 79c397f2) failed `test` for the original finding 1, which is now fixed.
