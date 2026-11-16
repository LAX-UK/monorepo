Verdict: FIX FIRST

# Final recheck of PR #1488 "Shop and lax.art: shared empty states"

Reviewed head: `33cc8483` (branch `shop-art-shared-empty-states`). This covers the commits after `6e88bfd5`: `479033d6`, `2fbb2fef`, `ec130aa1`, `9011bdce`, `720df7ee`, `4da1f3fe`, `90ab4bfc`, `33cc8483`, plus the main merge `c2747f7d` (base `aef61e26`).

The PR branch was not changed.

There is no "Changes after review" section, so this review is judged from the commits and the code.

**Summary**

- The code fixes from the last review are in:
  - Shop and lax.art route JS is below main.
  - Pages that own an h1 keep a single h1, with tests.
  - Reduced motion and the phone stacking are restored.
  - `art-browser-gates` is green.
  - The non-blocking items are cleaned up.
- Two things still block:
  - The PR description contradicts the code in several places.
  - CI's Bid (`apps/web`) `account` and `checkout` rows read slightly above main. The evidence says this is build noise and not the PR's code, but by the stated bar it has to be cleared.

## Blocking

1. **The PR description contradicts the code.** It was not updated after review. Statements that are now false:
   - **Kit props that no longer exist.** It says the kit `EmptyState` gains `accent` and `announcement`, and that kit tests cover them.
     - `9011bdce` removed both props.
     - The plate ink is now the CSS token `--lax-plate-ink` → `--color-lax-plate`:
       - `packages/ui/src/lax/theme.css:71`
       - `apps/shop/src/app/base.css:162`
       - `apps/art/src/app/base.css:182`
     - The live regions now live in the wrappers:
       - `apps/shop/src/components/shop-status-state.tsx:59,79`
       - `apps/art/src/components/art-status-state.tsx:49,67`
   - **Where `resolveStatusIllustration` lives.** It says `resolveStatusIllustration` "stays in `marketing-ui`". It moved to `packages/ui/src/lax/status-illustration.ts` (export `@auction/ui/lax/status-illustration`).
   - **"Their CSS is unchanged."** `MarketingStatusAction` has a new phone rule, `flex: 1 1 100%` under `max-width: 39.99rem` (`packages/marketing-ui/src/marketing-ui.css:363-368`).
   - **"Page layout with the page's h1."** The page layout now takes an explicit `headingLevel`, and 28 page-layout call sites pass `titleAs="h2"` (`packages/ui/src/lax/empty-state.tsx:68,73`).
   - **The route JS section is stale.** It shows the pre-review table (shop product 557.7, public 524.1, art 523.5/525.4/529.1), says "69 of 82 routes grew", and calls sharing the illustration module "a follow-up". The latest CI build shows every Shop and lax.art route group below main, and the forced `lax-empty-state` chunk (`apps/shop/next.config.ts:54-76`, `apps/art/next.config.ts:54-75`) is that follow-up, done.
   - **Fix:** rewrite the description from the current code. List the kit changes as they now are: `headingLevel` honoured on the page layout, `headingLevel="p"`, `title` as a node, the `--lax-plate-ink` token, and the new `status-illustration` export. Also cover the forced chunk, the phone rule, the latest CI route JS table, and the pre-existing art mobile flake (item 2 under Verified).

2. **CI route JS: the Bid `account` and `checkout` rows read above main.** The cause is very likely build noise, not this PR, but it needs a clean CI table before merge.

   | app / group | main CI at the PR's base code (run 43818820212, job 133137626187) | main latest CI (run 43833229669, job 133184013355, `24483d2d`) | PR CI (run 43834015218, job 133186469487) |
   |---|---|---|---|
   | web account | 545.4 KB (frame 442.7) | 545.1 KB (frame 442.5) | **545.6 KB** (frame 442.9) |
   | web checkout | 471.7 KB (frame 441.1) | 471.4 KB (frame 440.9) | **472.1 KB** (frame 441.3) |
   | web listing / lot / public / sale | 462.3 / 467.5 / 394.5 / 478.9 | 462.3 / 467.5 / 394.6 / 478.9 | 462.3 / 467.5 / 394.5 / 478.9 |

   - **Why I think it is noise:**
     - In local builds on one machine (`next build` with the CI placeholder DSNs, then `check-route-js-budget.mjs --app apps/web --all`), no Bid account or checkout route is larger in the PR than at main `8ed75236`:
       - account: 70 routes from −0.3 to 0.0 KB
       - checkout: 4 routes from −0.2 to −0.1 KB
     - Every Bid client chunk that carries the kit state (`data-empty-state`) is 41 bytes raw and 13–27 bytes gzip **smaller** in the PR: chunks 16334, 18875, 51863, 6092 and 94522.
     - Main's two CI builds above also moved by 0.3 KB on these rows, for unrelated changes.
     - Local lot and sale read +2.3 KB against my local main build. CI main reads exactly the PR's numbers there (467.5 / 478.9), so that is an artefact of my local main build, not growth.
   - **Fix:** no code change is expected. Merge or rebase onto current main and re-run CI. The PR's `build` table must show every `apps/web` row ≤ main's latest CI table. If account/checkout still read higher, find the chunk that grew before merging.

## Non-blocking

- **The shop and art `next.config.ts` files carry the same `EMPTY_STATE_MODULES` list and `addEmptyStateChunk`.** They are almost line for line the same (Shop adds its two boundary modules). Consider a shared helper so the two cannot drift.
- **Shop and art each declare their own `LIVE_ROLES` map and announcement union.** `shop-status-state.tsx:42,79` and `art-status-state.tsx:31,67` define the same thing. It is small, but it could live next to `status-illustration.ts`.
- **The eyebrow sits inside the h1 as an `aria-hidden` span** (`apps/shop/src/components/artwork/artwork-detail-state.tsx:38-45`).
  - It now sits directly above the title in the copy column, as asked. The h1's accessible name stays "Artist not found".
  - Screen readers that ignore `aria-hidden` inside headings are rare, so this is fine. A sibling element above the h1 would be cleaner.
- **`docs/marketing-design-language.md:121` says "Static page loads are silent".** lax.art errors default to polite (`art-status-state.tsx:48`). Say "Shop states are silent; lax.art errors are polite".
- **The bottom tab bar in the 375 screenshots** (`art__favourites-empty__375__dark__after-review.png`) is captured over the middle of the page. That comes from the fixed bar in a full-page capture, not from the state. It is worth a note in the evidence README so reviewers do not read it as overlap.

## Verified

1. **Route JS for Shop and lax.art is at or below main on every group (blocking item 1 of the last review: fixed).** PR CI job 133186469487 against main's latest CI job 133184013355:

   | app / group | main | PR | duplicates main → PR |
   |---|---|---|---|
   | shop account | 520.4 | 517.2 | 20 (5.1) → 9 (3.5) |
   | shop checkout | 551.8 | 549.0 | 7 (4.8) → 9 (2.5) |
   | shop product | 552.9 | 550.1 | 9 (6.2) → 9 (3.9) |
   | shop public | 520.5 | 518.2 | 5 (4.1) → 7 (2.1) |
   | art account | 522.1 | 521.3 | 7 (3.0) → 6 (2.7) |
   | art product | 524.0 | 523.3 | 5 (3.5) → 4 (3.3) |
   | art public | 527.7 | 527.0 | 4 (2.7) → 3 (2.5) |

   - The frames are 1.0–2.8 KB lighter.
   - The illustration is no longer copied into each boundary: one forced `lax-empty-state` chunk (`apps/shop/next.config.ts:54-76`, `apps/art/next.config.ts:54-75`).
   - `scripts/route-js-budgets.json` and the ratchets are untouched. `apps/web/next.config.ts` matches the base.
2. **CI.**
   - **`art-browser-gates` is green** on the latest run (43834015264, job 133186198337).
   - The chromium-mobile "favourites tabs are signed-in routes" test (`apps/art/e2e/art-journeys.spec.ts:237`) is still flaky there. It failed twice (sign-in timeout, then the Follows URL not changing) and passed on retry #2.
   - **It is pre-existing.** Main's own merge-queue run for #1489, which does not include this PR (run 43833229661, job 133183484279), has the same test flaky on chromium-mobile: a 30 s timeout in `signInArtBuyer`, then a pass on retry #1. So this PR does not cause it. It deserves its own ticket.
   - `browser-gates`, `account-browser-gates`, `build`, `test`, `static-checks` and the web/shop-api/api vitest shards are all green on `33cc8483`.
3. **One h1 (blocking item 2 of the last review: fixed).**
   - The kit honours an explicit `headingLevel` on the page layout and defaults to h1 only when none is given (`packages/ui/src/lax/empty-state.tsx:68,73`).
   - Both wrappers pass `titleAs` through (`shop-status-state.tsx:58,72`, `art-status-state.tsx:47,60`).
   - Every `layout="page"` call under a page-owned h1 passes `titleAs="h2"`: basket, checkout, confirmation, cancel, account orders, order detail, report a problem, order not-found, guest orders, guest report, for-artists/apply, and `application-status-views.tsx:243`.
   - Whole-page states keep h1: art `signed-out`, `session-expired`, `sign-in-error`, `account/disabled`, search, the editorial status, the art route error, and the Shop detail and route error.
   - Bid's two `layout="page"` users (`alerts/stop`, `alerts/confirm`) pass no `headingLevel`, so they keep h1.
   - Tests:
     - `shop-empty-states.test.tsx:47` and `art-empty-states.test.tsx:33`: page layout with `titleAs="h2"` renders an h2.
     - `apps/shop/src/app/basket/page.test.tsx:33`: the real basket page has one h1 "Basket" and an h2 "Your basket is empty".
     - `apps/art/src/app/for-artists/apply/page.test.tsx:16`: the real apply page, signed out, has one h1 "Apply to join" and an h2 "Sign in to apply".
4. **Reduced motion and phone actions (blocking item 3 of the last review: fixed).**
   - The `@media (prefers-reduced-motion: reduce)` block is back (`packages/marketing-ui/src/marketing-ui.css:326-334`). It turns off the transition and the `:active` translate.
   - The phone rule (`:363-368`) stacks the actions full width under 640 px. The `art__apply-signed-out__375__*__after-review.png` screenshots show "Sign in" and "Create an account" one per row at full width.
5. **Non-blocking items from the last review.**
   - **Eyebrow:** it now sits directly above the title in the copy column (`artwork-detail-state.tsx:33-48`). The actions are in the copy column and `children` sit under the whole state. Confirmed in `shop__detail-not-found__1440__light__after-review.png`.
   - **Dead code removed:**
     - `resolveAnnouncement`, the identity `headingLevel` mapping and `resolveLayout` are gone.
     - The `.shop-detail__state-*` and `.shop-detail--state` rules are gone from `catalogue.css`.
     - The `MarketingStatusState`/`MarketingStatusMotif` exports are gone (`packages/marketing-ui/src/index.ts`). `marketing-status-state.tsx` now holds only `MarketingStatusAction`.
   - **One illustration map:** `resolveStatusIllustration` in `packages/ui/src/lax/status-illustration.ts`, used by both wrappers. `ArtworkDetailState` takes a `LaxIllustrationName` directly; its own `ILLUSTRATIONS` map is gone.
   - **Docs updated:**
     - `docs/marketing-design-language.md:121-123`
     - `docs/ui/shop-storefront-architecture.md:59`
     - `docs/ui/art-figma-inventory.md:248`
     - No code or docs mention `MarketingStatusState`, `MarketingStatusMotif` or `ShopStateMotif` any more.
   - **Dark accent contrast on the paper plate:** new check in `scripts/ci/verify-status-pill-contrast.test.mjs:170-192`. It passes. I computed the ratios from the resolved tokens:
     - Shop: light 9.94:1, dark 8.56:1
     - lax.art: light 19.09:1, dark 15.71:1
     - All are above the 3:1 needed for a graphic.
6. **Bid is not affected in code.**
   - The kit change is opt-in: `headingLevel` on the page layout, `p`, and `title` as a node.
   - The plate falls back to `--lax-fg` when no product sets `--lax-plate-ink` (`theme.css:71`).
   - The kit `empty-state.js` grows by 85 bytes gzip, but the Bid chunks that carry it are smaller overall (see blocking item 2).
7. **Unit suites, run locally at `33cc8483` after building the workspace packages:**
   - `packages/ui`: 84 files, 610/610
   - `packages/marketing-ui`: 110 files, 702/702
   - `apps/shop`: 116 files, 720/720
   - `apps/art`: 103 files, 808/808
   - `apps/web`: 1523 files, 9927 passed, 10 skipped
8. **Screenshots** (`docs/pr-evidence/shop-art-empty-states/*__after-review.png`, 1440 and 375, light and dark).
   - Basket: one h1 "Basket", with the state title as a smaller h2 beside the parcel plate in the Shop accent (dark: lilac on the dark plate).
   - Detail not-found: eyebrow over the title in the copy column, ticket drawing in aubergine.
   - Favourites empty: a stacked plate and copy at 375.
   - Apply signed out: one h1 and stacked full-width actions at 375.
   - No horizontal overflow at 375.
