Verdict: FIX FIRST

# Review of #1541: lax.art home prerender

Reviewed at `dd61f652` against `docs/design/overnight-decision-pack-2026-11-17.md` §C (approved: D1–D4, Q1 300 s, Q2 verify no cookie reads, Q3 other routes later). The branch is based on `310c9417`, behind current main, and merges cleanly.

## What was run

- **lax.art build:** `turbo run build --filter=@auction/art`. Passed. Next lists `○ /prerendered/home` with a 5 m revalidate; `/` is `ƒ`.
- **`node apps/art/scripts/check-prerendered-routes.mjs`.** Passed. The manifest has `/prerendered/home` at `initialRevalidateSeconds: 300`.
- **`apps/art` `vitest run`.** 111 files, 848 tests passed.
- **shop-api:** `vitest run src/infrastructure/http-art-cache-invalidator.test.ts src/routes/admin/v1/art-cache*`. 12 passed.
- **`turbo run typecheck`** for art and shop-api. Passed.
- **`biome check`** on the changed files. Clean.
- **`node scripts/check-route-js-budget.mjs --allow-no-sentry`.** Passed, all art groups "ok". `budgets.json` is untouched.
- **Manual run:** `next start` with the CI env and no shop-api. A document `GET /` is rewritten to `/prerendered/home`: first `x-nextjs-cache: MISS`, then `HIT`. The HTML has the `<h1>` hero and the section `<h2>`s inline, with no `hidden id="S:…"` streamed segments.
- **Not run:** the Playwright `e2e/home-prerendered.spec.ts`, which needs the seeded stack. It was read only.

## Blocking

1. **Signed-in visitors see the header and footer change after load, on every lax.art page, and the header shifts.**
   - **Where:** to keep the root layout free of cookies, the account chrome now starts as a guest and is replaced after a browser fetch of `/api/viewer`: `apps/art/src/app/layout.tsx:68` (`ArtViewerChromeProvider guest={artGuestViewerState()}`) and `apps/art/src/components/viewer/art-viewer-chrome.client.tsx:24-25`. The root layout wraps every route, so this hits the whole site, not only home.
   - **What changes on screen:** from 1024 px the header's account control draws "Account" for a guest, but an avatar and first name for a signed-in visitor (`packages/marketing-ui/src/marketing-account-entry.tsx:134-176`). That's a different width, inside the right-hand `justify-end` cluster with the search field, theme toggle and favourites (`apps/art/src/components/header/art-header.client.tsx` `trailing`). So on every page load a signed-in visitor sees "Account", then their name, and the cluster moves.
   - **Same pattern elsewhere:**
     - The phone tab bar (`layout.tsx:88`).
     - The footer Account list (`art-footer.tsx:17` → `ArtFooterAccountList`).
     - An "unavailable" account, where the guest control is drawn and then removed (`ArtAccountEntry` returns null).
   - **Why it blocks:** the brief requires that anything personal moves client-side *without layout shift*, with zero visual change. The screenshots and the pixel-diff in `docs/design/screenshots/art-home-prerender/README.md` are signed-out only, so this isn't covered.
   - **Fix (one option):** draw an account slot whose size doesn't depend on the viewer until it has been read. For example, reserve the signed-in trigger's footprint and keep the control `visibility: hidden` until the snapshot lands. Or draw the right shape before first paint from a non-sensitive, client-readable hint, the way `ArtThemeInit` does for the theme.
   - **Tests to add:** a signed-in screenshot or CLS check at 1440 and 375 (home plus one dynamic page) showing no shift.

## Checked against the pack

- **D1, static and checked in CI.**
  - `apps/art/src/app/prerendered/home/page.tsx:17` sets `revalidate = 300`.
  - Middleware rewrites only document GET/HEAD requests for `/` there (`apps/art/src/lib/routing/prerendered-routes.ts:29-47`), and 308-redirects direct visits to `/prerendered/*`.
  - `check-prerendered-routes.mjs` fails when the route leaves the prerender manifest or its revalidate is outside 1–300 s. It's wired into `ci.yml` after Build (`--skip-unbuilt` for affected builds) and into `art-e2e-pr.yml`.
  - The literal D1 wording says "`/` marked static"; here `/` stays `ƒ` and the prerendered copy carries every document request. The PR explains why: React still streams a large page out of the HTML under a `loading.tsx` boundary. That's a reasonable reading of D1 together with D3. Not a defect.
- **Nothing in the home render reads the request.**
  - `composeArtHomePage` no longer takes viewer or favourites ports (`apps/art/src/lib/home/home-page.composer.ts` around `NONE`).
  - The root layout dropped `cookies()`, using `ArtThemeInit` for the theme and a client read for consent.
  - Slug reads used by home are cached and tagged via `artPrerenderedPageServices` (`apps/art/src/lib/art-services.server.ts:131-147`).
  - The build proves it: the route is in the prerender manifest.
- **Hearts and Follow.** Drawn unset, then seeded from `/api/viewer/favourites` (`private, no-store`). These don't change size.
- **D2, one shared helper.**
  - shop-api: every editorial and catalogue write goes through the single `ArtCacheInvalidator`. `invalidateEditorial` covers every non-GET 2xx on the editorial admin routes (`registerArtCacheInvalidation`). `invalidateCatalogue` covers artworks, artists, home-features, Zoho link, inventory moves, and the gallery-sale and linked-listing tasks. It now always adds `art:home` (`apps/shop-api/src/infrastructure/http-art-cache-invalidator.ts:10-22`).
  - lax.art: one `revalidateArtCache` maps `art:home` to `revalidatePath("/prerendered/home", "page")` (`apps/art/src/lib/revalidate/revalidate-art-cache.ts`).
  - Both sides are unit-tested, and the e2e covers the round trip.
- **D3.** `(home)/loading.tsx` is unchanged. `(home)/page.tsx` is `force-dynamic`, so in-app navigation still gets the MO12 loading screen.
- **D4.** A document request returns the hero and section titles inline. The e2e runs JS-off at 1440 and 375.
- **Q3.** The routes that would otherwise turn static now that the layout stopped reading cookies are pinned `force-dynamic`, so they behave as before. Only `/_not-found` (not personal) and the home copy are now prerendered.
- **Route JS.** No budget raised, and all groups pass.

## Non-blocking

1. **The e2e skeleton check skips image placeholders.** It counts `.lax-skeleton:not([role="img"])` (`apps/art/e2e/home-prerendered.spec.ts:42`), while D4 says "no `.lax-skeleton` … in the first viewport". With JS off, the lazy hero picture still draws the hatched `MediaImage` placeholder, which the README acknowledges as the #1502 follow-up. Either make the first-viewport hero image eager so the check can drop the exclusion, or record the exception in the pack.
2. **`drop-build-time-html.mjs` deletes every prerendered route,** not just the required ones (`apps/art/scripts/drop-build-time-html.mjs:26`). Today that's `/_not-found` and `/prerendered/home`. The build fails if a future static non-HTML route (for example a static `robots.txt`) appears, because it looks for `<route>.html`. Consider limiting it to `REQUIRED_PRERENDERED_ROUTES` plus `/_not-found`.
3. **A failed read at regeneration is cached for everyone.** A shop-api outage during regeneration bakes the inline section errors into the shared HTML for up to the revalidate period (the response carries `s-maxage=120`). Before, each request retried. This is acceptable inside the 300 s ceiling but worth a line in the PR's risks.
4. **The cookie banner now opens after hydration** for undecided visitors (`art-analytics-consent.client.tsx`), instead of being in the server HTML. This is a small change in timing.
