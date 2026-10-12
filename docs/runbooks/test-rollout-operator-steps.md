# Test rollout — operator steps (Shop + lax.art)

Code and CI wiring for the “Finish LAX on test” plan are on branch `fix/shop-api-payouts-app-env` (monorepo) and `feat/test-art-lax-bid-infra` (auction-infra). These steps require **explicit approval** for Terraform apply, GitHub variable changes, and workflow dispatch.

## A. Shop Connect webhook + publishable key

1. Done 2026-10-12 on the **London Art Test** sandbox: checkout and Connect webhooks on `https://test-shop.lax.bid/webhooks/stripe{,/connect}`, `STRIPE_SHOP_*` test secrets and `STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art` ([shop-stripe-setup.md](./shop-stripe-setup.md)).
2. Merge the auction-infra change that passes `stripe_shop_publishable_key` and `stripe_shop_connect_platform_key` to `shop-api`.
3. Merge and **Terraform apply test** (ephemeral) with auction-infra changes for `stripe_shop_connect_webhook_secret`, `STRIPE_PUBLISHABLE_KEY`, `SHOP_CONNECT_TRANSFERS_ENABLED`.
4. Verify: unsigned POST → **400**; signed-in payee `GET /commerce/me/connect/config` → non-null `publishableKey`.

## B. lax.art on test

1. Merge auction-infra PR (`feat/test-art-lax-bid-infra`); apply **persistent** then **ephemeral** test.
2. Merge monorepo; run **build-images** / deploy so `lax-test-art:<sha>` exists.
3. Run **terraform-test-up** (or app deploy) with `art_sha` pinned.
4. Verify: `https://test-art.lax.bid/health/ready` → `status=ok`, `release=<art_sha>`, dependencies include art-identity + shop-api.

## C. Phase 2 (`SHOP_CONNECT_TRANSFERS_ENABLED`)

1. Run **Shop staging acceptance** twice (`seed_catalogue=true`); record run IDs in [shop-v1-phase-gates.md](./shop-v1-phase-gates.md).
2. Onboard one payee on Shop `/account/payouts` until **Ready** (proves Connect webhook).
3. Set GitHub var `SHOP_CONNECT_TRANSFERS_ENABLED=true`; Terraform apply test.
4. Confirm a `due` payout becomes **Paid** with `tr_…`; staff mark-paid returns **409**.

## D. Phase 3

Set `SHOP_THIRD_PARTY_ENABLED=true` (approval) → apply → two acceptance runs → record IDs.

## E. Phase 4

Set `SHOP_ORIGINALS_ENABLED=true` and `SHOP_MERCHANDISE_ENABLED=true` together → apply → two acceptance runs → record IDs.

Run originals journey per [shop-live-qa-checklist.md](./shop-live-qa-checklist.md) (lax.art section).

## F. Live QA + Sentry

Complete [shop-live-qa-checklist.md](./shop-live-qa-checklist.md). Resolve or snooze unrelated worker/auth Sentry noise; shop/art services should have no active regressions.

## G. Hygiene

| Item | Action |
| --- | --- |
| monorepo #501 | Reconcile with auction-infra OIDC art-web migrate output; close if redundant |
| monorepo #423 | E2E sign-in helper — assign owner or merge |
| monorepo #391 | SSO Terraform doc — assign or close |
| auction-infra #36 | `terraform fmt` — satisfied on art infra branch |
