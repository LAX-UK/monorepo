Verdict: FIX FIRST

# Review of PR #1488 "Shop and lax.art: shared empty states"

Reviewed head: `6e88bfd5` (branch `shop-art-shared-empty-states`), base `5569ca0e` (main).
This review covers only the PR. The PR branch was not changed.

**What it was judged against.** The audit decisions S13 and D9 are not in the repository. I searched `docs/` and `docs/design` on main and on the PR branch for `S13`, `BP-14` and "artistic empty space", and ran a GitHub code and PR search. The only `D9` is the unrelated architecture decision about the OIDC issuer in `docs/architecture/02-decisions.md:137`. So I judged the PR against:

- the kit `EmptyState` contract in `packages/ui/src/lax/empty-state.tsx`: "page" means "a whole-page state with the page's h1, for not found and route errors"
- `docs/DESIGN_SYSTEM.md`
- how LAX Bid uses the kit, in `apps/web/src/components/marketing/marketing-empty-state.tsx`: inline layout, `headingLevel` h2/h3, no `layout="page"` inside a page that already has an h1

## Blocking

1. **Route JS grew on several routes.** I compared the PR's CI build table with main's own latest CI build table.
   - PR: CI run 43809697600, job `build` 133108655182.
   - main: merge-queue run 43805181198 at `5569ca0e`, job 133094757392.
   - I reproduced the PR numbers locally from a production build of shop and art (same within 0.1 KB).

   | app / group | main largest | PR largest | change | duplicates main → PR |
   |---|---|---|---|---|
   | shop product (`/artworks/[slug]`) | 552.8 KB | 557.8 KB | **+5.0 KB** | 9 (6.2 KB) → 18 (11.3 KB) |
   | shop public (`/artworks/(hub)`) | 520.4 KB | 524.2 KB | **+3.8 KB** | 5 (4.1 KB) → 11 (7.8 KB) |
   | art account (`/account/favourites`) | 522.0 KB | 523.5 KB | **+1.5 KB** | 7 (3.0 KB) → 11 (5.4 KB) |
   | art product | 524.0 KB | 525.5 KB | **+1.5 KB** | 5 (3.5 KB) → 9 (6.0 KB) |
   | art public (`/for-artists/apply`) | 527.7 KB | 529.1 KB | **+1.4 KB** | 4 (2.7 KB) → 8 (5.2 KB) |
   | shop account | 520.4 KB | 518.6 KB | −1.8 KB | 20 → 7 |
   | shop checkout | 551.8 KB | 550.3 KB | −1.5 KB | 7 → 7 |

   - The shop and art frames grew by about 4–5 KB and 1.5 KB. The PR says 69 of 82 routes grew.
   - The duplicate counts roughly doubled. The illustration module is now duplicated across the error-boundary chunks, which the PR description also says.
   - "Still under budget" is not the bar here: any growth on any route blocks.
   - **Fix:** the kit `EmptyState` (or the `LaxIllustration` set it imports) has to land in one shared chunk. For example, keep route `error.tsx` boundaries off the full illustration set, or import a single drawing. Then the shop and art rows must be ≤ main's.

2. **Two h1s on about 30 Shop and lax.art screens.** This is a heading-order and accessibility regression.
   - The cause: `packages/ui/src/lax/empty-state.tsx:72` forces `h1` whenever `layout="page"` (`const Heading = isPage ? "h1" : headingLevel`).
   - The wrappers map `layout="page"` straight through (`apps/shop/src/components/shop-status-state.tsx:88`, `apps/art/src/components/art-status-state.tsx:57`), so an explicit `titleAs="h2"` is now silently ignored.
   - On main, `MarketingStatusState` honoured `titleAs` (`packages/marketing-ui/src/marketing-status-state.tsx:95,100`).
   - I confirmed it by rendering the real components:
     - **Basket empty** (`apps/shop/src/app/basket/page.tsx:136-141`, inside `ShopCommercePageShell`): `<h1>Basket</h1>`, then `<h1>Your basket is empty</h1>`, then `<h2>On sale now</h2>`.
     - **`/for-artists/apply`, signed out** (`apps/art/src/components/artist-application/application-status-views.tsx:243-244` under the page's own h1 at `apps/art/src/app/for-artists/apply/page.tsx:67`): `<h1>Apply to join the gallery</h1>`, then `<h1>Sign in to apply</h1>`.
   - The same `layout="page"` + `titleAs="h2"` pattern is at:
     - `basket/page.tsx` (3)
     - `checkout/page.tsx` (4)
     - `checkout/confirmation/page.tsx` (5)
     - `checkout/cancel/page.tsx` (2)
     - `account/orders/page.tsx` (4)
     - `account/orders/[orderId]/page.tsx` (2)
     - `account/orders/[orderId]/report-a-problem/page.tsx` (3)
     - `account/orders/[orderId]/not-found.tsx` (1)
     - `orders/guest/page.tsx` (2)
     - `orders/guest/report-a-problem/page.tsx` (1)
     - `for-artists/apply/page.tsx` (2)
     - `application-status-views.tsx` (1)
   - The PR's own tests check the h1 only where `titleAs="h1"` was passed. Nothing checks that `titleAs="h2"` stays h2.
   - Bid never puts a page-layout state under an existing h1.
   - **Fix:** in the wrappers, use the kit's inline layout when the page already owns its h1 (`titleAs !== "h1"`). Alternatively, let the kit honour an explicit `headingLevel` on the page layout. Then add a test that `layout="page" titleAs="h2"` renders an h2.

3. **The PR removes the reduced-motion rule for the actions, but says their CSS is unchanged.**
   - The PR says `MarketingStatusAction`'s "CSS is unchanged" and "No hover, press or loading code touched".
   - It deletes the `@media (prefers-reduced-motion: reduce)` block at `packages/marketing-ui/src/marketing-ui.css:533-541` on main. That block switched off the action's `transition` and the `:active { transform: translateY(1px) }` press nudge.
   - The press motion is still there (PR file, lines 310-312), so it now plays for people who asked for reduced motion.
   - The same hunk also deletes the phone rule that stacked the actions full-width (main lines 569-586). The kit's `@max-2xl:[&>*]:flex-1` now lays them out side by side. At 375 px, "Create an account" wraps onto two lines in a half-width button.
   - **Fix:** restore the reduced-motion block. Either restore the phone rule too or call out the change.

4. **CI: `art-browser-gates` is red on this PR and green on main.**
   - The PR run is 43809697494, job 133108484774. `[chromium-mobile] e2e/art-journeys.spec.ts:237` "favourites tabs are signed-in routes" failed all three attempts. After the "Follows" tab click, the URL stayed `/account/favourites` (expected `/account/favourites/follows`). The first attempt also timed out in sign-in.
   - Main's latest merge-queue run of the same workflow (43805181158, `5569ca0e`) and the run before it both passed.
   - `/account/favourites` is one of the pages whose empty state this PR changed. I could not prove the cause without the full stack, so this may be a flake.
   - Either way, it needs a green re-run, or a root cause, before merge.
   - `browser-gates` (web) was still running when I checked. `ci-result` and the other CI jobs passed.

## Non-blocking

- **The eyebrow is cut off from its heading on Shop detail not-found, unlisted and unavailable pages.**
  - Where: `apps/shop/src/components/artwork/artwork-detail-state.tsx:36`.
  - The `Not found` eyebrow is now a loose `<p>` above the whole kit grid, about 120 px from the h1 and over the plate column. The PR's own `shop__detail-not-found__1440__light__after.png` shows this.
  - Before, it sat directly above the h1.
  - `children` (the search form and links) now render outside the text column (line 44) instead of under the description.
  - Put the eyebrow and children into the state (for example through `control`/`whileYouWait`), or keep them in the copy column.
- **Error variants lose their meaningful drawings.** The kit always draws `askew` for `variant="error"`.
  - Before (`marketing-status-state.tsx:136` on main), only `gallery` was swapped.
  - So basket "Sign in again" (`icon="bag"`) and "Your account cannot apply right now" (`icon="lock"`, `for-artists/apply/page.tsx:122-130`) lose the parcel and lock drawings.
  - This matches Bid's kit rule, but it is a visual change the description does not mention.
- **Dead code left behind.**
  - `resolveAnnouncement()` in `shop-status-state.tsx:63` takes no arguments and always returns `"none"`. Inline it.
  - `const headingLevel = titleAs === "p" ? "p" : titleAs` (`shop-status-state.tsx:81`) is an identity.
  - `.shop-detail__state-media`, `.shop-detail--state .shop-detail__content` and `.shop-detail__state-copy` in `apps/shop/src/app/catalogue.css:45,80,84` no longer have any markup.
  - `resolveLayout` still sniffs `className` for `shop-status-state--page`. A real prop would be cleaner.
- **Duplication.**
  - `ArtworkDetailState` keeps its own `ILLUSTRATIONS` map (`artwork-detail-state.tsx:7-13`), alongside `resolveStatusIllustration` in marketing-ui. Reuse the one map.
  - The motif and layout types still live in `@auction/marketing-ui` while the behaviour lives in the kit. Move them, and `resolveStatusIllustration`, next to the kit or into the wrappers, so marketing-ui only owns `MarketingStatusAction`.
- **Stale docs** that still describe the removed `MarketingStatusState`, banner layout or `ShopStateMotif`:
  - `docs/marketing-design-language.md:121,123` (also wrong for Bid, whose `MarketingEmptyState` already uses the kit)
  - `docs/ui/shop-storefront-architecture.md:59`
  - `docs/ui/art-figma-inventory.md:248`
- **The catalogue no-match state still uses the hatched "Editions" plate** (`apps/shop/src/components/catalogue/catalogue-states.tsx:23`), not a drawing. It is unchanged from main and passed through the `plate` slot. Note it if S13 means drawings everywhere.
- **The kit accent tests only check for a class string.** `empty-state.test.tsx` checks that `--color-product-accent` appears somewhere in the markup. It does not check contrast of the accent line on `bg-lax-paper` in dark mode. The shop dark accent `#d6a8d4` is documented only against the dark surfaces, not the paper plate.

## Verified

- **Unit suites, run locally at the PR head after building the workspace packages:**
  - `packages/ui`: 607/607
  - `packages/marketing-ui`: 702/702
  - `apps/shop`: 715/715, including the `checkout-return-origin` test the description called flaky
  - `apps/art`: 805/805
  - `apps/web`: see the last line of this file.
- **Coverage:** no `MarketingStatusState`, `MarketingStatusMotif` or `ShopStateMotif` is left in code.
  - Every Shop and lax.art empty and error state goes through `ShopStatusState`, `ArtStatusState` or `ArtworkDetailState`, and all three now render the kit `EmptyState`.
  - I found no hand-rolled empty state in `apps/shop/src` or `apps/art/src`. I grepped for `length === 0` branches, "No … yet/found" copy, and `empty` class names.
- **Bid is not affected:** `accent` and `announcement` are additive and `headingLevel="p"` is opt-in. Bid's `MarketingEmptyState` sets none of them, and `apps/web` route JS changed by ≤ 0.1 KB.
- **Accent:** each product keeps its own accent through `--color-product-accent`. It is defined in `apps/shop/src/app/base.css:38,302` and `apps/art/src/app/base.css:38,285`.
- **Theme wiring:** both apps import `@auction/ui/lax-theme.css` and `@source` the kit, so the kit classes are generated.
- **Copy:** no copy file is in the diff, and titles and descriptions are passed through unchanged. Links and `href`s inside the states are unchanged. `ArtworkDetailState` keeps "← Back to Collect".
- **Announcements are as before:**
  - Shop errors are silent unless asked; on main they were assertive only for the unused banner layout.
  - lax.art errors are polite.
  - The lax.art route error (`apps/art/src/app/error.tsx`) stays assertive (kit default) with an h1.
- **Non-empty states:** errors, unavailable and not-found were already drawn by the same `MarketingStatusState` on main. Moving them to the kit's error/page variants matches Bid, which uses the kit for fetch errors, not-found and route errors. None of them became an `empty` variant.
- **Production renders:** I built shop and art and rendered the changed states with the build CSS at 1440 and 375, light and dark: basket empty page, catalogue empty and no-match, home rail empty, detail not-found, art section empty, search no-results, account list empty, and apply sign-in.
  - No horizontal overflow at 375.
  - The layout matches the kit as Bid renders it: a plate beside the copy at desktop and stacked on phones, with the same tokens.
  - The PR's own before/after screenshots agree with what I rendered, apart from the issues noted above.
- **No other restyling:** the only CSS removed is the status-state block in `marketing-ui.css`, apart from item 3 above, and Shop's `state.css` title overrides for that block.

Web unit suite (`apps/web`, local): still running at the time of this commit; result to follow in a later commit. CI `web vitest (1-8/8)` all passed on run 43809697600.
