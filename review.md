Verdict: FIX FIRST

# Review of PR #1523: "Lot card: clean picture, save heart on the Lot line, quick look on hover"

Head reviewed: `883e17de` (6 commits on `feat/lot-card-clean-image`, base `4ab41e66`). It merges cleanly onto the current `origin/main` (`b3a5d708`).

## How this was checked

- I built the stack locally: Postgres 16, Redis, migrate + `db:seed:local`, production builds of `api`, `auth-app` and `web`, and `scripts/ci/start-e2e-web.mjs`. Then I drove it with Playwright (Chromium) at 1440, 1280, 1024 and 375 (touch), in light and dark, signed out and signed in (seeded `user1`).
- The PR's e2e, `lot-card-clean-image.spec.ts` and `quick-look-back.spec.ts` (the #1513 Back/View lot fixes), ran against that stack: **9/9 passed**.
- Vitest: the lot-card, lib/lot-card, saleroom card/live, marketing lot-card and lot-quick-look suites. **90/90 passed.**
- I made my own screenshots and looked at them myself. They are in `review-shots/`.

## What is good

These parts of the PR work as intended:

- **Sale page grid, decisions 1–3.** In the running app the picture is clean at rest. The heart sits at the right end of the "Lot N" line.
  - Signed in, saving gives `aria-pressed="true"`, the label "Remove … from your watchlist" and a target of 50×44. The fill is `--color-product-accent`: `#091f5b` in light and the 45% mix in dark.
  - The "Quick look" label shows on hover (`sale-1440-light-hover.png`) and on Tab from the picture link (`sale-1440-dark-keyboard-focus.png`).
  - At 375 with touch there is no quick-look trigger, and a tap opens the lot page (`sale-375-dark.png`).
  - Reduced motion is honoured.
- **Decision 4 (one frame).** Every department style now maps to `ONE_FRAME` in `packages/marketing-ui/src/lot-media/lot-card-media-frame.ts:27`.
- **Decision 6 (sale page).** `lotCardBidAction` (`apps/web/src/lib/lot-card/lot-card-bid-action.ts:51`) is small, pure and well unit-tested.
- **Budgets and constraints:**
  - No route-JS budget, baseline or allowance file is touched.
  - Lenis is untouched.
  - All 6 commits are by `mahmoudamrspace <mahmoudamr.space@gmail.com>` and carry no trailers.
- **Quick look after #1513.** Back, X, Forward and reload all still pass `quick-look-back.spec.ts`.

## Findings (must fix)

### 1. Not one shared card. Home rails and search's card view still put the heart on the artwork

The brief asked for ONE card component, so that every lot grid changes together. The PR shares two pieces, `LotCardLotLine` and `LotCardQuickLook`. But there are still three separate lot-card components, and only two of them were changed:

| Grid | Component | After this PR |
| --- | --- | --- |
| Sale page | `SaleroomLotCard` (`apps/web/src/components/sections/saleroom/saleroom-lot-card.tsx:62`) | Changed. |
| Search, grid view | `LotCardGrid` (`apps/web/src/components/marketing/lot-card.tsx:97`) | Changed, but it looks different from the sale card: a tinted shell, inner padding and **no full-width button** at all. Compare `search-1440-light-hover.png` with `sale-1440-light-hover.png`. |
| Search, card view (`?view=card`) | `LotCardEditorialCalm` (`apps/web/src/components/marketing/catalog-lot-views.tsx:169-186`) | **Heart still on the picture** (`surface="onImage"`, `:183`). Wide crop, no mat (`search-card-view-1440.png`). Fails decisions 1, 2 and 4. |
| Home rails | `MarketingWorkCard` via `HomeLotGrid` (`apps/web/src/components/sections/home/sections/home-lot-grid.tsx:28-41`) | **Heart still on the picture** for every watchable lot: `overlayAction` with `surface="onImage"`, rendered `absolute right-2 top-2` inside the media box (`packages/marketing-ui/src/marketing-work-card.tsx:99`). No quick look, no Lot line. Fails decisions 1–3. |
| Artist page, departments, `/sell` | `MarketingWorkCard` | Gets the frame only. No Lot-line heart, no quick look, no state-aware button. |
| Saved (`/watching`) | Record list | Frame only. The PR's argument (a list, not a grid) is acceptable. |
| lax.art | `MarketingWorkCard` (artworks, title-line favourite) | Not touched. It already has nothing on the picture. |

The PR body says "every lot grid that shows lot cards gets it", but it lists only the sale page and search. The home rails are missing from that list, and they are in the brief.

- **Failure scenario.** A signed-in visitor on the home page sees the round heart on top of each upcoming lot's picture. The same lot on the sale page shows a clean picture with the heart on the Lot line. On search `?view=card`, the heart is on the picture for every lot.
- **Fix.**
  1. Make one `LotCard` (picture box + `LotCardLotLine` + title + meta + action slot) the only lot-card component. Render the sale page, search (grid and card views), home rails and artist grid through it, with each surface supplying only data and extras.
  2. At the very least, before merge, move the home `overlayAction` heart to the Lot line, and drop `surface="onImage"` from search's card view.
  3. Add a test that fails if any lot grid renders a watchlist button inside the media box. An e2e that walks `/`, `/search?view=grid`, `/search?view=card`, the sale page and an artist page would do it.

### 2. "Register to bid" can label a step the button does not do (decision 6)

- **Where.** `apps/web/src/components/sections/saleroom/saleroom-viewer-islands.tsx:202` passes only `register.href` to the card. `lot-card-bid-action.ts:57-59` then always says `LOT_CARD_COPY.registerToBid`.
- **The problem.** `salePrimaryViewerAction` → `registerToBidAction` (`apps/web/src/lib/sale/sale-primary-viewer-action.ts`) returns different steps, and each has its own label:
  - "Verify identity to bid" (or a KYC feedback label), linking to identity onboarding;
  - "Set up a buyer profile", linking to `/onboarding/organisation`;
  - "Register to bid", linking to sign-up or `#register-to-bid`.
- **Failure scenario.** A signed-in viewer without approved KYC opens a sale before a lot opens. The hero says "Verify identity to bid", but every card says "Register to bid" and goes to identity onboarding. A viewer with no buyer entity sees "Register to bid", which goes to organisation setup. That is a label for an action the button does not do. It also contradicts the PR's own claim that "the card and the hero always agree".
- **Fix.** Either pass the presenter's `label` through (`register: { href, label }`) and render it, or show "Register to bid" only when the step really is registration (sign-up or `#register-to-bid`). Add unit cases for the KYC and buyer-profile steps.

### 3. The PR body ends with an AI footer

The PR description ends with `_Generated by [Claude Code](https://claude.ai/code)_`. The brief requires a PR body without an AI footer.

**Fix:** delete the footer lines from the PR description.

### 4. No test fails if the saved heart loses the Bid accent

- **Where.** The accent is applied only by `.lot-card-save .fill-live-red` (`apps/web/src/styles/lot-card.css:28-31`). The test `lot-card-clean-image.test.tsx:181-182` only asserts that the svg has the class `fill-live-red`, which is the red, pre-PR colour.
- **Mutation check.** I deleted the CSS rule and the whole suite still passed (90/90). In the app, the saved heart then turns live red.
- **Fix.** Assert the rule in the CSS-reading helper, as is already done for the quick-look media query. Or add an e2e assertion that the saved heart's computed `fill` equals `--color-product-accent`.

## Findings (should fix)

### 5. The e2e button-label test passes on `main`, so it does not guard decision 6

- **Where.** `apps/web/e2e/lot-card-clean-image.spec.ts:105-130` accepts "Bid" as a label everywhere, and only checks that the href equals the picture link (`:125`). On `main` every card said "Bid" to the lot page, so this test is green without the change. With the seed I used, every lot shown was open, so only "Bid" was exercised.
- **Fix.** Add a case that drives a scheduled lot, either seeded or by moving the times in the DB the way the PR's screenshots did. Assert "Register to bid" for a signed-out visitor and "Leave a bid" (`?bid=open`) for `user1`.
- **Also.** The `/bid/i` locator also matches the bidder-state "Bid £X" button for an outbid viewer, so the test would fail for that state. Scope it to the card's last action instead.

### 6. Avoidable skeleton → nothing on onsite and draft sales (layout shift)

- **Where.** `lot-card-bid-action.ts:56` returns `pending` for every not-yet-open lot while the viewer read is in flight. That happens before the function checks whether this sale could ever show a button.
- **Failure scenario.** On an onsite sale, or a draft sale, every scheduled lot draws a 40px skeleton. It then resolves to `null` for every viewer, because `salePrimaryViewerAction` returns `null` for non-web sales and `saleAcceptsAdvanceBids` is false. Each grid row then shrinks by the button height. I watched the skeleton → "-" transition on the seeded hybrid sales. There the row height held only because other cards in the same row kept a button.
- **Fix.** Before the `viewer === null` check, return `null` when neither a register step nor an advance bid is possible for this sale, whoever the viewer is. Or keep an empty block of the button's height when a pending slot resolves to nothing.

### 7. Quick look label and status pill share the bottom edge on narrow cards

- **Where.** `lot-card.css:41-45` centres the label at `bottom: 0.75rem`. The status pill sits at `bottom-1.5 left-1.5 md:bottom-3 md:left-3`, on the same baseline.
- **What I saw.** At 1024 on search they sit edge to edge (`search-1024-quicklook-beside-pill.png`). A longer pill ("In saleroom", "On the block") or a narrower desktop column, such as a 2-column tablet with a mouse, will overlap them.
- **Fix.** Raise the label above the pill row, or right-align the label when there is a pill.

## Nits

- **Duplicated helper.** `lot-card-bid-action.ts:62` re-implements `lotBidHref` inline. The commit says this keeps a module out of the bundle. Either move `lotBidHref` into a tiny shared module, or note why this duplicate exists next to the original, so the two cannot drift.
- **Pass-through helper.** `viewerRegisterStep` (`saleroom-viewer-islands.tsx`) only spreads its arguments into `salePrimaryViewerAction`. Call the presenter directly.
- **Tab order on search.** On search the quick-look button comes before the title link, so a screen reader hears "Quick look at X" before the lot's name. Consider putting the title link first in DOM order, and keep the quick look visually on the picture.
- **Unverified browser.** The PR says WebKit was not run. I did not run it either. The hover gating is `(hover: hover) and (pointer: fine)` and is worth one WebKit/iPad pass before release.

## Checklist against the owner decisions

| Decision | Sale page | Search grid | Search card view | Home rails | Artist page |
| --- | --- | --- | --- | --- | --- |
| 1. Only the status pill on the picture | ✅ | ✅ | ❌ heart on image | ❌ heart on image | ✅ (no heart) |
| 2. Heart on the Lot line, outline, 44px, accent, name and pressed state | ✅ (accent untested) | ✅ | ❌ | ❌ | ❌ no heart |
| 3. Quick look on desktop hover and focus, none on phones | ✅ | ✅ | ❌ | ❌ | ❌ |
| 4. One frame | ✅ | ✅ | ❌ wide crop, no mat | ✅ | ✅ |
| 6. Button names the action | ⚠️ "Register to bid" for KYC and profile steps | ❌ no button | ❌ | ❌ | ❌ |
| #1513 quick look Back and View lot | ✅ e2e green | – | – | – | – |
| Budgets, Lenis, commits | ✅ | | | | |
| PR body without AI footer | ❌ | | | | |
