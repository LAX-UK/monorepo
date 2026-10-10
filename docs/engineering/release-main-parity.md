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

As of release head `85ce35ba` (2026-10-10) the four commits after
`b385dfb0` add no migrations, so the approved mapping still describes the
production ledger. The shipped `db:adopt-release-lineage --apply` only replays
main migrations on a disposable database; it does not rewrite a production
ledger. Production rows at `1788000004000`–`1788000007000` hold the release
`0128`–`0131` hashes, while main assigns those timestamps to `0128`–`0131`
(role index, onsite links, Stripe Connect errors), so `db:migrate:prod` will
fail closed with "Migration history diverged" until a ledger-normalization step
exists and has been rehearsed on a production snapshot.

## Promotion checklist (main → release)

1. Ledger normalization for the production database is implemented, reviewed,
   and rehearsed on a restored production snapshot (see above). Blocking.
2. Every release-only commit since the last promotion has a row in the table
   above (`git log --cherry-pick --right-only main...release`).
3. Test environment runs the candidate SHA on every component, with onboarding
   flags at their production values, and the hosted-login parity audit
   (`docs/runbooks/bid-hosted-login-parity-audit.md`) passes.
4. Production Terraform sets `kyc_onboarding_enabled`,
   `full_buyer_onboarding_enabled`, and `strict_bid_eligibility_enabled`
   explicitly; unset values default to off when `APP_ENV=production`.
5. Identity grants for `0160`/`0161` stay staged via
   `PRODUCTION_MIGRATION_THROUGH` per `docs/architecture/06-deployment.md`.
