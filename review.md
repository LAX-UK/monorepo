Verdict: SHIP

# Final recheck: PR #1544, Shop: SHOP_EXPRESS_CHECKOUT flag and Stripe.js policy for basket and Details

Checked against `docs/design/decision-pack-2026-11-17.md` section 3 (option B, PR plan step 1).
Head rechecked: `a2de27951` ("Allow Link in the express checkout policy, test it against an exact
allow-list"). That is `cf2b3a28c` plus a merge of main plus the fix commit. Merges cleanly into main
`d087a2900`.

## Previous finding

**1. Wildcard `https://*.js.stripe.com`: closed by orchestrator decision.** It stays in `script-src`
and `frame-src` (`apps/shop/src/lib/security/express-checkout-headers.ts:23`) because Stripe's
security guide lists it as a required Stripe.js source. It's no longer a finding.

## Recheck items

| Item | Result |
|---|---|
| Link sources added | Pass. `https://link.com` and `https://*.link.com` are in `frame-src` and `connect-src`, and `https://*.link.com` is in `img-src` (`express-checkout-headers.ts:10-12`, used at `:25` and `:74-82`). The new `img-src` also names `https://*.stripe.com` (`:28`) and the Shop's own image hosts: `'self'`, the media CDN and `SHOP_IMAGE_REMOTE_HOSTS`, matching `next.config.ts` `remotePatterns`. Product images on the two pages therefore still load: they are served through same-origin `/_next/image`, and the Shop has no raw `<img>`. |
| Exact allow-list test of Stripe-documented sources | Pass. `express-checkout-headers.test.ts:93-104` splits every directive and fails on any source that isn't an allowed keyword (`'self'`, `'none'`, `'unsafe-inline'`, `data:`, `blob:`) or a listed origin. `:70-83` pins the full `script-src`, `frame-src` and `connect-src` strings exactly, each ending at `;`. So a stray wildcard or host in any of those three directives fails a test. |
| Single validated env source for the flag | Pass. `isShopExpressCheckoutEnabled()` now returns `loadShopEnv().SHOP_EXPRESS_CHECKOUT` (`apps/shop/src/lib/shop-runtime-flags.ts:20-22`), the same value the middleware reads (`middleware.ts:60`). It is validated as `z.enum(["true","false"])`, defaults to `false`, and a blank value is treated as unset (`env.ts:30,57`). Nothing reads `process.env.SHOP_EXPRESS_CHECKOUT` directly any more. |
| Runbook note | Pass. `docs/runbooks/shop-stripe-setup.md:79-81` covers the values, the default, the Stripe source list, and that an invalid value fails closed (every Shop page errors). |
| CSP only on `/basket` and `/checkout`, only while on | Pass. Unchanged since the first review. |

## Findings

None blocking.

## Non-blocking notes

- The test's allow-list (`express-checkout-headers.test.ts:22-34`) is built from the module's own
  exported constants. That's fine for the three pinned directives, but `img-src` is only pinned by
  its suffix (`:82`), so a source added to `STRIPE_JS_IMG_SOURCES` or `STRIPE_LINK_IMG_SOURCES`
  would still pass. Pinning the whole `img-src` string, as the other three are, would close that gap.
- I couldn't fetch Stripe's guide from this sandbox (docs.stripe.com is outside its network
  allow-list), so I haven't compared the Link hosts against the live page. Before turning the flag
  on, the real-device checks (plan step 4) should watch the browser console for CSP violations.

## Test runs (local, Node 22, CI env, on #1546 head `d812eba5a`; `apps/shop` there is byte-identical to `a2de27951`)

- `apps/shop` `tsc --noEmit`: pass.
- `apps/shop` `vitest run`: 122 files, 750 tests, all pass.
