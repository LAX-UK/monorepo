Verdict: SHIP

# Final recheck of #1541: lax.art home prerender

Rechecked at `7775e5bf` (main merged in, base `bd5ad5f5`) against `docs/design/overnight-decision-pack-2026-11-17.md` §C. The earlier review's blocking finding is fixed: signed-in visitors saw the account chrome change and shift while the browser read the visitor. No defects remain that block.

## What was run

- **lax.art build** (`turbo run build --filter=@auction/art --force`, CI env). Passed.
  - Next lists `○ /prerendered/home` (5 m) and `○ /_not-found`, with `ƒ /`.
  - `drop-build-time-html` dropped both prerendered routes' build-time HTML.
- **`node apps/art/scripts/check-prerendered-routes.mjs`.** Passed: "prerendered as required: /prerendered/home".
- **`node scripts/check-route-js-budget.mjs --allow-no-sentry`.** All art groups "ok". Largest: `public`, 522.4 KB against 579 KB. `git diff bd5ad5f5...HEAD -- budgets.json scripts/` is empty, so no budget was raised.
- **Unit tests.**
  - `apps/art` `vitest run`: 112 files, 854 tests passed.
  - `packages/marketing-ui` `vitest run`: 111 files, 707 tests passed.
- **`turbo run typecheck`** for art, marketing-ui and shop-api: 32 tasks passed. **`biome check`** on the changed files: clean.
- **Playwright** against `next start` of that build, with no shop-api, using the preinstalled Chromium:
  - `e2e/viewer-chrome-stable.spec.ts` with `--repeat-each=4`: 16/16 passed.
  - `e2e/art-chrome.spec.ts`: passed.
  - In the very first cold run, `/artworks` at 1440 failed once with "layout shift in the header, tab bar or footer". See non-blocking 1.
- **My own footprint measurement.** `/api/viewer` held open, then answered as guest, signed-in or unavailable, on `/` and `/artworks` at 1440, 1024 and 375. I compared bounding boxes of the header account slot, the favourites button, the tab bar's Account tab and the footer Account list before and after the answer. The results are in the next section.
- **An independent pass against §C.** It confirmed the fix. Its two "defects" are assessed under non-blocking 2 and 3.

## Blocking finding from the last review: fixed

**The footprint is reserved and identical.** In every combination of page, width and viewer state, the boxes were the same before and after the answer:

| Width | Header account slot | Favourites button | Tab bar Account tab | Footer Account list |
| --- | --- | --- | --- | --- |
| 1440 | 1228,50,160×44 | 1172,50,44×44 | not shown | 200×60 |
| 1024 | 812,50,160×44 | 756,50,44×44 | not shown | 131×60 |
| 375 | not shown | not shown | 225,756,75×56 | folded |

**Nothing personal or guest-only is drawn early.**
- **Header (1440).** The slot is `invisible` and `inert` until settled (`apps/art/src/components/header/art-account-entry.tsx:140-141`, width `lg:w-40` at `:35`).
  - While pending it is hidden with no text.
  - Once settled it shows "Account" for a guest, "CA Christopher" for a signed-in visitor, and stays hidden for an unavailable account.
  - A signed-in visitor never sees the guest control.
- **Tab bar (375).** While pending, the labels are the same for every visitor and the Account icon space is empty.
  - Once settled, a signed-in visitor gets the avatar in the same `size-6` space.
  - A guest's links become the sign-in links.

**The root layout still reads no cookies.**
- `apps/art/src/app/layout.tsx:68` wraps the chrome in `ArtViewerChromeProvider guest={artGuestViewerState()}`.
- Nothing in the layout, the chrome composer or the viewer and layout components imports `next/headers` or reads the session.
- The build output confirms it: `/prerendered/home` is in the prerender manifest.

**Signed-in CLS and screenshot checks exist.**
- `apps/art/e2e/viewer-chrome-stable.spec.ts` covers 1440 and 375 on `/` and `/artworks`. In CI it uses the real seeded buyer (`ART_E2E_BUYER_EMAIL` in `art-e2e-pr.yml`).
- The pending and settled screenshots are in `docs/design/screenshots/art-home-prerender/`.

## Still fine against §C

D1 to D4, Q1 to Q3, the D2 tag wiring and the D4 exception (now recorded in the pack) are as described in the last review. I re-verified D1 through the build and the manifest check above.

## Non-blocking

1. **The shift observer can flake on a cold start.**
   - `viewer-chrome-stable.spec.ts:73` observes with `buffered: true` from first paint, so any chrome shift during hydration counts, not only one caused by the viewer read.
   - It failed once on the first cold `/artworks` load, then passed 16 times in a row.
   - Consider starting the measurement after `load`, or counting only shifts after the held read is released, so CI doesn't flake.
   - The e2e also measures signed-in visitors only, and not 768–1023. Guest, unavailable and disabled are covered by unit tests on class names and by my measurement above.
2. **Hearts and Follow on the prerendered home treat a signed-in visitor as a guest until `/api/viewer` answers.**
   - `ArtPageViewerProvider` derives `signedIn` from `account` and ignores `settled` (`apps/art/src/components/viewer/art-page-viewer.client.tsx:35-36,56`).
   - A heart tapped in that first round-trip sends a signed-in visitor through sign-in and back, and the save is lost.
   - The window is narrow, the visitor ends up signed in, and nothing shifts. Hearts were accepted in the last review, so this doesn't block.
   - Fix: expose `settled` and make the toggles a no-op, or `aria-disabled`, until then.
3. **While pending, the phone tab bar links Favourites and Account to `/account/...` with default prefetch, for guests too.**
   - Where: `apps/art/src/components/layout/art-bottom-bar.client.tsx:41`. On main, guests got plain sign-in links.
   - **Why it's harmless:** I checked against the build. An RSC request through a server `redirect()` returns 200 with the redirect inside the payload, and a prefetch doesn't follow it. So identity's sign-in start is never requested, and the `ArtAuthLink` no-prefetch rule (`apps/art/src/components/art-auth-link.tsx:10`) is not broken.
   - **The cost:** one extra dynamic `/account` RSC request per guest phone page view.
   - Fix: pass `prefetch: false` on these tabs while pending.
4. **Guest header at 1024–1279 has a wider gap.** The 160 px slot leaves a visible gap left of a guest's "Account". At 1024 nothing crowds or overlaps; I checked a screenshot of the guest header. This is noted in the PR's risks.
5. **Carried over from the last review.** These are still open and not blocking:
   - A failed read at regeneration is cached for everyone, up to the revalidate period.
   - The consent banner now opens after hydration.
