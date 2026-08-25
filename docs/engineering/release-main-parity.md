# Release → main feature parity

Main is the future source of truth. Release-only work is re-expressed in main’s layers rather than cherry-picked. This ledger records how each feature landed and where behaviour deliberately diverges.

| Feature | Release commit | Main equivalent | Method | Deliberate difference |
|---|---|---|---|---|
| Shared rollout flag parser | Duplicated `parseEnabled` in four `rollout.server.ts` files | `packages/validators` `parseBooleanFlag` / `parseOptionalBooleanFlag`; web re-exports via `apps/web/src/lib/rollout/parse-boolean-flag.ts` + `resolve-rollout-flag.server.ts`; API/worker env schemas reuse the same parser | Re-designed | One parser across web, API, and worker; strict bid still falls back on `APP_ENV`, the other web flags on `NODE_ENV` |
| Buyer KYC / identity onboarding / strict eligibility | Multiple release commits | `feat/kyc-onboarding-main` | Re-implemented | Domain + persistence + bidding-runtime ports; `IBidActorEligibilityReader` stays in persistence to avoid a `bidding-runtime` ↔ persistence cycle |
| Buyer interest catalog + save/reconcile | `b557a286`, `99d20e3d`, `96a20f18`, `55e1d7f7`, `0af613c6` | Migration `0139`, `packages/domain` `reconcileBuyerInterestSelection`, repository adapter tests | Re-implemented | Catalog completion is additive `0139`; 0138 no longer mutates existing rows |
| KYC rollout hardening | `1c0f97d2`, `6a6cc332`, `c89b8fca` | Telephone booking bound to sale/user/entity; KYC session reuse keyed on `callbackUrl` | Re-implemented | Presentation stays in web presenters; fail-closed gates stay in bidding-runtime |
| Unified bid blocker UX | `17287326` | `BidBlockerPresentation` + `blockBid` + `BidBlockerNotice` + policy migrations | Re-designed | No `render` closure; unsupported-mode and connection are first-class policies, not `resolveRuntimeBidBlocker` |
| Contextual marketing prompts | `d5a42208` | `lib/marketing/prompts/**` + orchestrator/dialog | Re-designed | Route eligibility and selling intent split out; `PROMPT_RULES` table; analytics port; AVIF/WebP assets |
| CI secret-scan scoping | `3e8a1fb3` | `.github/workflows/ci.yml` `--log-opts` | Ported | Applied to main’s 6-job CI; release `.gitleaksignore` fingerprint `f634d8bb` is not copied |

Terraform `variable` blocks for `strict_bid_eligibility_enabled`, `kyc_onboarding_enabled`, `full_buyer_onboarding_enabled`, and `marketing_prompts_enabled` live in the private `.infra-config` repo. In-repo wiring is workflows, env examples, `docker-compose.prod.yml`, and `turbo.json` only.

See also [D15](../architecture/02-decisions.md) and [D16](../architecture/02-decisions.md).
