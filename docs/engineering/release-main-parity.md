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
| ATG White Label sync (GAP API) | #509 (`0b2a90fa`), #512 (`125e00c4`) | Worker `integrations/atg/**` and `workers/register-atg-sync-worker.ts` (#PR_WORKER); `packages/queues` `atg-sync`; migration `0131a_atg_sync_links` and the lineage mapping (#PR_DATA); `/admin/integrations/atg`, the one-platform-per-sale guards and the read-only public catalogue (#PR_API); the sale **ATG** tab and public ATG display (#PR_WEB). `TF_VAR_atg_*` in `terraform-apply-prod.yml` was already in place. | Re-implemented | Re-sync is tick-driven (no enqueue hooks in sale/lot services). Flag off by default. Main's repositories live in `packages/persistence`, so the ATG reader and public-catalogue SQL are there rather than in `apps/api`. |
| ATG White Label cookie isolation | `efa2683a`, `3043c67f` (`feat/atg-integration-release`), `auction-infra` #41 | `lax_acting_legal_entity_id` is host-only on main, and the client expires a lingering `Domain=.lax.bid` copy (#PR_WEB). Main's sessions are host-only `__Host-` cookies, so the `atg-cookie-shield` Worker (in `auction-infra`) is defence in depth. | Re-implemented | Release keeps shared `.lax.bid` sessions and relies on the Worker. ATG is not yet registered as an OIDC client in `packages/identity-contracts/src/clients.ts`: ATG has not supplied redirect URIs (open questions 13 and 14 in `docs/integrations/atg.md`). |

Terraform `variable` blocks for `strict_bid_eligibility_enabled`, `kyc_onboarding_enabled`, `full_buyer_onboarding_enabled`, and `marketing_prompts_enabled` live in the private `.infra-config` repo. In-repo wiring is workflows, env examples, `docker-compose.prod.yml`, and `turbo.json` only.

See also [D15](../architecture/02-decisions.md) and [D16](../architecture/02-decisions.md).

## Identity migration lineage

`release` and `main` are intentionally not directly upgrade-compatible today. The
verified comparison on 2026-09-13 found `release`
(`b385dfb06f6d7324f310e1c8180cd9ffb49ca3d9`) at migration `0131` and `main`
(`af0a1e31265a26d005d51e73e022875fa54f7396`) at `0161`; the release
`0128`–`0131` hashes differ from main even though the
four feature SQL files are byte-identical to main's renumbered `0135`, `0137`,
`0138`, and `0139`.

Any future production upgrade must use an approved, dry-run-first lineage
adoption tool that recognizes only those exact release hashes, verifies the
byte-identical mapping, normalizes the ledger through `0139`, and then applies
main migrations. `0159` remains rolling-compatible. Before an old production
binary can run after `0160`/`0161`, its required user-table grants must be
restored. This is an Identity-scoped compatibility record, not evidence that
the broader `release` → `main` merge is safe.

The approved release head is now `bd1556dff97d290b3183f24347c040a0c60652a7`
(`packages/db/src/release-lineage-mapping.ts`), which adds release `0132`
(ATG sync links) and `0133` (two-factor lockout columns) to the four feature
migrations above. The shipped `db:adopt-release-lineage --apply` only replays
main migrations on a disposable database; it does not rewrite a production
ledger. Its dry run verifies every mapped SQL hash and prints what ledger
normalization will do with each release row. Production rows at
`1788000004000`–`1788000007000` hold the release `0128`–`0131` hashes, while
main assigns those timestamps to `0128`–`0131` (role index, onsite links,
Stripe Connect errors), so `db:migrate:prod` will fail closed with "Migration
history diverged" until a ledger-normalization step exists and has been
rehearsed on a production snapshot.

## ATG migration lineage

Release `0132_atg_sync_links` (tables `atg_auction_link`, `atg_lot_link`; additive,
`IF NOT EXISTS`) is applied in production with journal `when` **`1788000007500`**, after
release `0131` (`1788000007000`) and before main's `0132_domain_event_delivery`
(`1788000008000`).

Main registers the byte-identical SQL as `0131a_atg_sync_links` at the same `when`, between
its `0131` and `0132` entries, so the production row matches by hash. Main's own databases
(test, developer) were migrated past that stamp before it existed. The migration runner stops
on a ledger that has later rows but not an earlier journal entry ("Migration history is
missing ... before applied timestamp"), so a mid-journal registration alone would break them.
`packages/db/src/late-registered-migrations.ts` therefore lists the stamp: the runner applies
that additive, idempotent migration in place and records its ledger row. A row with a
different hash at that stamp still fails closed. `atg_auction_link` and `atg_lot_link` are in
`WORKER_FULL_TABLES`. `migration-main-upgrade.integration.test.ts` covers a clean database, an
environment past the stamp, a production ledger that already holds the row, a divergent row,
and the rollback.

The full integration record is `docs/integrations/atg.md`.

## Release `0133_two_factor_lockout_columns`

Release `0133_two_factor_lockout_columns` carries journal `when` **`1788000008000`**, which is
also main's `0132_domain_event_delivery`. Production has applied it. Its SQL is
byte-identical to main's `0222_two_factor_lockout_columns` (`ADD COLUMN IF NOT EXISTS`).

Ledger normalization must **replace** that release row with main `0222`, not keep it: a kept
row at `1788000008000` has a different hash from main `0132`, so the migrator would report a
divergence, and under the "apply newer than the last `created_at`" rule it would shadow main
`0132`. Dropping the row lets main `0132` apply at its own stamp and `0222` re-run, which is
harmless. `RELEASE_TO_MAIN_SQL_MAPPING` records this as the `replace` action, and
`planReleaseLedgerNormalization` fails closed if the stamp no longer matches `0132`.

## Pending release migration `0133_atg_sale_settings`

Release work not yet on `release` (local branch `feat/atg-production-readiness`) adds
`0133_atg_sale_settings`: per-sale ATG auction type and distribution, a locked-fields hash, no
`ApproveAuction`, and a JPG/10 MB image preflight. It is not ported here. Before it ships it
must be renumbered **`0134`** with a journal `when` **greater than `1788000008000`** (for
example `1788000008500`). The migrator only applies migrations newer than the last applied
row, and production already holds `1788000008000`, so its original `1788000007750` would be
skipped silently. When it lands, add it to the lineage mapping and to the main journal after
`0132_domain_event_delivery` with the same stamp, and list that stamp in
`late-registered-migrations.ts` so main's existing databases apply it in place.

## Promotion checklist (main → release)

1. Ledger normalization for the production database is implemented, reviewed,
   and rehearsed on a restored production snapshot (see above). Blocking.
2. Every release-only commit since the last promotion has a row in the table
   above (`git log --cherry-pick --right-only main...release`), and the ATG
   migration lineage steps above are done.
3. Test environment runs the candidate SHA on every component, with onboarding
   flags at their production values, and the hosted-login parity audit
   (`docs/runbooks/bid-hosted-login-parity-audit.md`) passes.
4. Production Terraform sets `kyc_onboarding_enabled`,
   `full_buyer_onboarding_enabled`, and `strict_bid_eligibility_enabled`
   explicitly; unset values default to off when `APP_ENV=production`.
5. Identity grants for `0160`/`0161` stay staged via
   `PRODUCTION_MIGRATION_THROUGH` per `docs/architecture/06-deployment.md`.
