# Release → main feature parity

Main is the future source of truth. Release-only work is re-expressed in main’s layers rather than cherry-picked. This ledger records how each feature landed and where behaviour deliberately diverges.

| Feature                                              | Release commit                                              | Main equivalent                                                                                                                                                                                                             | Method         | Deliberate difference                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared rollout flag parser                           | Duplicated `parseEnabled` in four `rollout.server.ts` files | `packages/validators` `parseBooleanFlag` / `parseOptionalBooleanFlag`; web re-exports via `apps/web/src/lib/rollout/parse-boolean-flag.ts` + `resolve-rollout-flag.server.ts`; API/worker env schemas reuse the same parser | Re-designed    | One parser across web, API, and worker; strict bid still falls back on `APP_ENV`, the other web flags on `NODE_ENV`                              |
| Buyer KYC / identity onboarding / strict eligibility | Multiple release commits                                    | `feat/kyc-onboarding-main`                                                                                                                                                                                                  | Re-implemented | Domain + persistence + bidding-runtime ports; `IBidActorEligibilityReader` stays in persistence to avoid a `bidding-runtime` ↔ persistence cycle |
| Buyer interest catalog + save/reconcile              | `b557a286`, `99d20e3d`, `96a20f18`, `55e1d7f7`, `0af613c6`  | Migration `0139`, `packages/domain` `reconcileBuyerInterestSelection`, repository adapter tests                                                                                                                             | Re-implemented | Catalog completion is additive `0139`; 0138 no longer mutates existing rows                                                                      |
| KYC rollout hardening                                | `1c0f97d2`, `6a6cc332`, `c89b8fca`                          | Telephone booking bound to sale/user/entity; KYC session reuse keyed on `callbackUrl`                                                                                                                                       | Re-implemented | Presentation stays in web presenters; fail-closed gates stay in bidding-runtime                                                                  |
| Unified bid blocker UX                               | `17287326`                                                  | `BidBlockerPresentation` + `blockBid` + `BidBlockerNotice` + policy migrations                                                                                                                                              | Re-designed    | No `render` closure; unsupported-mode and connection are first-class policies, not `resolveRuntimeBidBlocker`                                    |
| Contextual marketing prompts                         | `d5a42208`                                                  | `lib/marketing/prompts/**` + orchestrator/dialog                                                                                                                                                                            | Re-designed    | Route eligibility and selling intent split out; `PROMPT_RULES` table; analytics port; AVIF/WebP assets                                           |
| CI secret-scan scoping                               | `3e8a1fb3`                                                  | `.github/workflows/ci.yml` `--log-opts`                                                                                                                                                                                     | Ported         | Applied to main’s 6-job CI; release `.gitleaksignore` fingerprint `f634d8bb` is not copied                                                       |
| Standing bid 404 for missing buyer legal entity      | `794eec4a`                                                  | `packages/bidding-runtime` `StandingBidEligibilityValidator`                                                                                                                                                                | Re-implemented | Lives in bidding-runtime, not `apps/api`                                                                                                         |
| Duplicate registration / resend for unverified email | `a63e645f`                                                  | Hosted sign-up (`sign-up-outcome.ts`) + hosted `/resend-verification`                                                                                                                                                       | Re-designed    | Success and existing-account outcomes are indistinguishable when verification is required (no enumeration)                                       |
| Forgot-password Turnstile gating                     | `6f104296`, `00231d4a`                                      | Hosted recovery page `turnstileHost()`                                                                                                                                                                                      | Superseded     | Bid web no longer renders forgot-password; Identity owns the form                                                                                |
| No default marketing footer tagline                  | `85ce35ba` (#459)                                           | `apps/web/src/components/layout/site-footer.tsx`                                                                                                                                                                            | Ported         | None                                                                                                                                             |
| ATG White Label sync (GAP API) | #509 (`0b2a90fa`), #512 (`125e00c4`) | Worker `integrations/atg/**` and `workers/register-atg-sync-worker.ts` (#588); `packages/queues` `atg-sync`; migration `0131a_atg_sync_links` and the lineage mapping (#587); `/admin/integrations/atg`, the one-platform-per-sale guards and the read-only public catalogue (#589); the sale **ATG** tab and public ATG display (#590). `TF_VAR_atg_*` in `terraform-apply-prod.yml` was already in place. | Re-implemented | Re-sync is tick-driven (no enqueue hooks in sale/lot services). Flag off by default. Main's repositories live in `packages/persistence`, so the ATG reader and public-catalogue SQL are there rather than in `apps/api`. |
| ATG White Label cookie isolation | `efa2683a`, `3043c67f` (`feat/atg-integration-release`), `auction-infra` #41 | `lax_acting_legal_entity_id` is host-only on main, and the client expires a lingering `Domain=.lax.bid` copy (#590). Main's sessions are host-only `__Host-` cookies, so the `atg-cookie-shield` Worker (in `auction-infra`) is defence in depth. | Re-implemented | Release keeps shared `.lax.bid` sessions and relies on the Worker. ATG is not yet registered as an OIDC client in `packages/identity-contracts/src/clients.ts`: ATG has not supplied redirect URIs (open questions 13 and 14 in `docs/integrations/atg.md`). |
| Onsite and hybrid sale schedule saves | #316 (`d3fe9879`) | #317 (`1adcca31`) | Ported | None |
| UTM attribution snapshot | #310 (`8ef2de61`), release migration `0128_marketing_attribution` | #309 (`c759dd90`), #315; migration `0135_marketing_attribution` | Re-implemented | Consent-gated on main. The SQL is byte-identical to release `0128`, so promotion adopts main `0135` instead of running it again (see "Migration lineage" below). |
| Two-factor enabled email only after the code is verified | `bf8f63cb` | `d5c2cdd0` | Ported | None |
| Two-factor lockout columns | #576 (`bd1556df`), release migration `0133_two_factor_lockout_columns` | #574 (`1d0bb5de`), migration `0222_two_factor_lockout_columns` | Ported | Byte-identical SQL under another tag and `when`; adopted on promotion. |
| ATG per-sale settings, approval state, bid locks and image checks | #667 (`23d848de`), release migration `0134_atg_sale_settings` | #666 (`693ab815`), migration `0234_atg_sale_settings` | Ported | Byte-identical SQL at the same `when` (`1795593600000`); adopted on promotion. |
| "Where this sells" badge in admin | #668 (`2244bd4c`) | #732 (`05fff139`) | Ported | None |
| Worker table grants | #715 (`f8158ef9`) | #725 (`255681de`); `worker-table-grants.test.ts` on both | Ported | None |
| Refund notice backlog skip | #715 (`f8158ef9`), release migration `0135_payment_refund_notify_skip_backlog` | None | Not ported | A one-off production data fix: it moved the refund notice projector past refunds recorded while the projector was stalled. Main's projector reads the same `projector_state` row, so the effect carries over. Promotion archives the ledger row only. |
| ATG timed auctions send `TimedStart` only | #734 (`0133bb19`) | #735 (`0654b227`) | Ported | None |
| ATG lot images named with a `.jpg` extension | #737 (`0dd8bddb`) | #738 (`43cda8e4`) | Ported | None |
| Offline banner confirmed by a probe | #776 (`6f5d6b8e`) | #775 (`a7da3f03`), `browser-connectivity.client.ts` | Re-implemented | Lands as part of a wider set of fixes on main. |
| Private-test ATG drafts hidden from the public sales list and detail | #790 (`44be9ee8`) | #791 (`8f1fd8ab`) | Ported | None |

Terraform `variable` blocks for `strict_bid_eligibility_enabled`, `kyc_onboarding_enabled`, `full_buyer_onboarding_enabled`, and `marketing_prompts_enabled` live in the private `.infra-config` repo. In-repo wiring is workflows, env examples, `docker-compose.prod.yml`, and `turbo.json` only.

See also [D15](../architecture/02-decisions.md) and [D16](../architecture/02-decisions.md).

## Migration lineage

Release and main share migrations `0000`–`0127` byte for byte: same tag, `when` and SQL
hash. Above that, the approved release head (`44be9ee8`, recorded in
`packages/db/src/release-lineage-mapping.ts`) wrote eight ledger rows whose stamps collide
with, or sit between, main's own migrations:

| Release row | `when` | Main equivalent | On promotion |
| --- | --- | --- | --- |
| `0128_marketing_attribution` | `1788000004000` | `0135_marketing_attribution` | Adopted |
| `0129_user_category_interests` | `1788000005000` | `0137_user_category_interests` | Adopted |
| `0130_buyer_interest_categories` | `1788000006000` | `0138_buyer_interest_categories` | Adopted |
| `0131_complete_buyer_interest_categories` | `1788000007000` | `0139_complete_buyer_interest_categories` | Adopted |
| `0132_atg_sync_links` | `1788000007500` | `0131a_atg_sync_links` (same `when`) | Adopted |
| `0133_two_factor_lockout_columns` | `1788000008000` | `0222_two_factor_lockout_columns` | Adopted |
| `0134_atg_sale_settings` | `1795593600000` | `0234_atg_sale_settings` (same `when`) | Adopted |
| `0135_payment_refund_notify_skip_backlog` | `1795593660000` | None | Archived only |

Main's runner never skips silently: a ledger row with another hash at a main stamp, or a main
migration missing below the last row, stops it. So `db:migrate:prod` from main refuses
production's ledger as it stands ("Migration history diverged at 1788000004000"). Promotion
uses **archive and adopt**:

1. **Normalise** (`pnpm --filter @auction/db db:normalise-release-lineage
   --release-head=<sha>`, owner connection). It runs in one transaction and is a dry run unless
   `--apply` is passed; a dry run opens the transaction read-only and always rolls back. It
   checks every ledger row: rows up to `0127` must hold main's hash, and the rows above must be
   exactly the eight approved release rows, by stamp and hash. It then moves those eight rows
   into `drizzle.__release_lineage_archive`, so the ledger ends at main `0127`. Any unknown row,
   changed hash, missing row or unapproved head is refused and nothing is written. Running it
   again reports "already normalised" and writes nothing.
2. **Adopt** (`migrate-runner.ts`). The runner applies main from `0128`. When a pending
   migration is on the explicit allow-list (`0131a`, `0135`, `0137`, `0138`, `0139`, `0222`,
   `0234`) and the archive holds its release row with the same hash, the runner records main's
   ledger row without executing the SQL. Without this, main `0137` would run
   `UPDATE "user" SET category_interests_onboarding_completed_at = now()` again and mark every
   buyer who registered since August as having finished interest onboarding. Databases without
   the archive (test, developer, CI) adopt nothing.
3. Release `0135` stays archived only. Its effect, the refund notice projector moved past the
   stalled backlog, is already in production data, and main reads the same `projector_state`
   row.

`release-to-main-upgrade.integration.test.ts` reproduces production at the approved head
(main `0000`–`0127`, then release `0128`–`0135` executed in release order with release's
stamps and hashes), normalises it, runs the built `migrate-prod.js` at `head`, and checks that
the ledger matches main's journal, that `0137`'s update did not run, and that the schema and
reference data equal a database main built from scratch. It also covers an unknown extra row,
a changed hash, a dry run and re-runs.

**When release moves:** any new release commit changes the approved head. Compare release's
journal with the mapping; if release added a migration, add its row (with its disposition) to
`APPROVED_RELEASE_ROWS` and the fixture, then update `APPROVED_RELEASE_HEAD`. Normalisation
refuses any other head.

## ATG migration lineage

Release `0132_atg_sync_links` (tables `atg_auction_link`, `atg_lot_link`; additive,
`IF NOT EXISTS`) is applied in production with journal `when` **`1788000007500`**, after
release `0131` (`1788000007000`) and before main's `0132_domain_event_delivery`
(`1788000008000`).

Main registers the byte-identical SQL as `0131a_atg_sync_links` at the same `when`, between
its `0131` and `0132` entries. Main's own databases (test, developer) were migrated past that
stamp before it existed. The migration runner stops on a ledger that has later rows but not an
earlier journal entry ("Migration history is missing ... before applied timestamp"), so a
mid-journal registration alone would break them. `packages/db/src/late-registered-migrations.ts`
therefore lists the stamp: the runner applies that additive, idempotent migration in place and
records its ledger row. A row with a different hash at that stamp still fails closed. On
production, normalisation archives the release row and the runner adopts `0131a`.
`atg_auction_link` and `atg_lot_link` are in `WORKER_FULL_TABLES`.
`migration-main-upgrade.integration.test.ts` covers a clean database, an environment past the
stamp, a ledger that already holds the row, a divergent row, and the rollback.

The full integration record is `docs/integrations/atg.md`.

## Release `0133_two_factor_lockout_columns`

Release `0133_two_factor_lockout_columns` carries journal `when` **`1788000008000`**, which is
also main's `0132_domain_event_delivery`. Production has applied it. Its SQL is
byte-identical to main's `0222_two_factor_lockout_columns` (`ADD COLUMN IF NOT EXISTS`).
Normalisation archives the release row, so main `0132` applies at its own stamp, and the
runner adopts `0222`.

## ATG per-sale settings `0234_atg_sale_settings`

Per-sale ATG auction type and distribution, a locked-fields hash, no `ApproveAuction`, and a
JPG/10 MB image preflight land on `main` first as `0234_atg_sale_settings`, with journal `when`
**`1795593600000`** (after `0233_shop_order_reference_and_progress`). The SQL is additive and
idempotent. Release carries the byte-identical SQL as `0134_atg_sale_settings` at the same
`when`; normalisation archives that row and the runner adopts `0234`.

## Promotion checklist (main → release)

1. **Freeze release** from the day the promotion PR is opened: no more hotfixes on `release`.
   A fix needed after the freeze lands on main first; if it must also reach production before
   the cutover, it goes to release as well, and the freeze SHA, `APPROVED_RELEASE_HEAD` and
   this ledger are updated to match before the window.
2. Every release-only commit since the last promotion has a row in the table above
   (`git log --cherry-pick --right-only main...release`), and `APPROVED_RELEASE_HEAD` equals
   the frozen release SHA, with any new release migration mapped (see "Migration lineage").
3. Normalisation and `PRODUCTION_MIGRATION_THROUGH=head pnpm db:migrate:prod` are rehearsed on
   a restored production snapshot, with timings recorded. Blocking.
4. In the window, after writes stop and the restore point is taken: normalise (dry run, read
   the plan, then `--apply`), then run the migrate Job with `PRODUCTION_MIGRATION_THROUGH=head`.
   The cutover stops the old release binaries before `0160`/`0161` run, so the staged rollout
   in `docs/architecture/06-deployment.md` does not apply to it. The default stays `0159`
   until the cutover ships.
5. Test environment runs the candidate SHA on every component, with onboarding
   flags at their production values, and the hosted-login parity audit
   (`docs/runbooks/bid-hosted-login-parity-audit.md`) passes.
6. Production Terraform sets `kyc_onboarding_enabled`,
   `full_buyer_onboarding_enabled`, and `strict_bid_eligibility_enabled`
   explicitly; unset values default to off when `APP_ENV=production`.
