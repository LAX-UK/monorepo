Verdict: FIX FIRST

# Review: PR #1544, Shop: SHOP_EXPRESS_CHECKOUT flag and Stripe.js policy for basket and Details

Reviewed against `docs/design/decision-pack-2026-11-17.md` section 3, option B (approved; Q4 both
basket and Details, Q5 collection as a zero-price rate), PR plan step 1. Head reviewed: `cf2b3a28c`.

## What was checked

| Requirement | Result |
|---|---|
| Flag off by default everywhere | Pass. `apps/shop/src/env.ts:30-33` defaults to `"false"`; `.env.example` leaves it commented out; no Terraform or workflow sets it. |
| Flag validated | Pass. `z.enum(["true","false"])`, blank trimmed to unset (`env.ts:57`); `"1"`, `"TRUE"`, `"yes"` throw (`env.test.ts`, `middleware.express-checkout.test.ts`). |
| CSP only on the two routes | Pass. Exact match on `/basket` and `/checkout` (trailing slash tolerated) at `express-checkout-headers.ts:24-27`; `/checkout/confirmation`, `/checkout/cancel`, `/basket-help` and others get nothing. |
| CSP only when the flag is on | Pass. `express-checkout-headers.ts:82`; covered end to end by the middleware test. |
| No wildcard sources | **Fail**, see finding 1. |
| No blanket schemes (`https:`, `*`, `data:` on script/frame/connect) | Pass in production; `ws: wss:` only when `NODE_ENV=development`. |
| Tests | Present. They would fail without the code (new files). The wildcard is asserted *in* rather than out, see finding 1. |

Also confirmed: the Shop has no site-wide CSP today (no `headers()` in `next.config.ts`, none in infra),
so the new header doesn't combine with another policy. Browser traffic on the two pages still works
under it: Sentry goes through the same-origin `/sentry-tunnel`, search suggestions are same-origin,
FedCM and the silent sign-in `fetch` go to the identity origins named in `connect-src`, and there are
no third-party iframes on those pages.

## Findings

### 1. Blocking: wildcard source `https://*.js.stripe.com` in `script-src` and `frame-src`

`apps/shop/src/lib/security/express-checkout-headers.ts:15` and `:18`.

The review brief requires no wildcard sources. The policy allows scripts and frames from any subdomain
of `js.stripe.com`. The test `express-checkout-headers.test.ts:47-52` locks the wildcard in. Its "no
blanket scheme" check at `:66-73` only rejects `*.stripe.com ` (with a trailing space), so the wildcard
gets past it.

The repo already runs Stripe.js under a CSP without the wildcard: `apps/web/src/middleware.ts:58-59,73`
uses `https://js.stripe.com` in `script-src` and `https://js.stripe.com https://hooks.stripe.com` in
`frame-src`.

Fix: drop `https://*.js.stripe.com` from both lists, and change the test so it fails if any source
contains `*`. If real-device wallet testing (plan step 4) shows that Stripe needs a specific subdomain,
add that exact host by name. If it can't be done without the wildcard, get the owner to sign off on it
explicitly.

## Non-blocking notes

- `apps/shop/src/lib/shop-runtime-flags.ts:18` `isShopExpressCheckoutEnabled()` compares
  `process.env` directly and has no caller yet. When the UI PR uses it, read `loadShopEnv().SHOP_EXPRESS_CHECKOUT`
  instead, so there is a single validated source for the flag.
- `apps/shop/src/middleware.ts:53` now calls `loadShopEnv()` on every request. An invalid
  `SHOP_EXPRESS_CHECKOUT` value makes every Shop page throw, not just the two checkout pages. That fails
  closed, which is acceptable, but the runbook should say so.
- There is no `form-action` directive. That doesn't matter today because the hosted-page redirect is a
  navigation, but keep it in mind if the policy is ever widened to more pages.

## Test runs (local, Postgres 16 + Redis, CI env)

- `apps/shop` `tsc --noEmit`: pass.
- `apps/shop` `vitest run`: 122 files, 750 tests, all pass. (Run on the #1546 head; `apps/shop` is
  byte-identical between #1544 and #1546.)
