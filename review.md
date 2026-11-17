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

## Final recheck

Head rechecked: `9b71ab2b` (9 commits, base `b3a5d708`; it merges cleanly onto the current `origin/main`, `ab2ca97c`). I rebuilt the stack locally (Postgres 16, Redis, migrate + `db:seed:local` + roles + OIDC clients, production builds of `api`, `auth-app` and `web`, `scripts/ci/start-e2e-web.mjs`, with CI's env) and drove it with Playwright. My screenshots are in `review-shots/final/`.

**Verdict: FIX FIRST.** All the findings are fixed except one. Finding 6 (skeleton → nothing on onsite sales) is still visible in the running app, on the exact page the PR says it fixed. Everything else is ready.

### Findings 1–7

| # | Status | Evidence |
| --- | --- | --- |
| 1. One shared card | ✅ Fixed | See below. |
| 2. Hero's register label | ✅ Fixed | The island passes `{ href, label }` (`saleroom-viewer-islands.tsx:181-190`), and `lotCardBidAction` renders `viewer.register.label`. If the label is hard-coded back to "Register to bid", 3 tests fail (2 unit: KYC and buyer profile; 1 component). |
| 3. AI footer | ✅ Fixed | The PR body ends with the screenshot table. There is no "Generated with/by" line. |
| 4. Accent untested | ✅ Fixed | If I delete the `.lot-card-save .fill-live-red` rule, `lot-card-clean-image.test.tsx › is filled in the Bid accent when saved` fails (1 failed / 34). In the live app, `user1` saving lot 2 gives `aria-pressed="true"`, "Remove … from your watchlist", 50×44, and a fill of `rgb(9,31,91)` = `#091f5b` in light and the 45% mix in dark. Shots: `sale-1440-*-signed-in-saved.png`. |
| 5. e2e passed on main | ✅ Fixed | The spec seeds a scheduled online sale and checks it. Locally, "Register to bid" signed out (it matches the hero) and "Leave a bid" with `bid=open` for `user1` both pass. The locators are scoped to `lot-card-action`. |
| 6. Skeleton → nothing on onsite and draft sales | ❌ **Not fixed in the app** | See below. |
| 7. Quick look label on the pill's row | ✅ Fixed | At 1024 on search the label's bottom is at 562.7 and the pill's top at 578.7, so there is a **16px gap**. At 1440 the gap is 16px too. The e2e also measures at least 38px from the label to the picture's bottom edge. Shots: `search-grid-1024-light-hover.png`, `search-card-1024-light-hover.png`. |

#### Finding 1 in detail

- `LotCard` (`apps/web/src/components/lot-card/lot-card.tsx`) is now the only lot card. It renders:
  - the sale page (`SaleroomLotCard`);
  - search grid and card views (`catalog-lot-views.tsx`);
  - home (`home-lot-grid.tsx`);
  - artist (`artist-works-grid.tsx`);
  - department (`department-work-card.tsx`);
  - the lot page's "More from" rail.
- These are deleted, and grep finds none of them in `apps/` or `packages/`: `LotCardGrid`, `LotCardEditorial*`, `MarketingLotTile`, `MarketingLotOverlayActions`.
- No `surface="onImage"` remains in `apps/web/src`. The only remaining `overlayAction` is the artist directory card, which is not a lot card.
- In the app, every card on `/`, `/search?view=grid`, `/search?view=card` and the sale page has 0 buttons inside `lot-card-media`. The heart is 50×44 and sits on `lot-card-lot-line`.

#### Finding 6 in detail

- **The fix in `lotCardBidAction`.** It is correct as far as it goes: removing its early `null` fails 2 tests. But it only covers the case where the *viewer* is pending.
- **The path it misses.** The sale grid has a second pending path, the live read. It renders a skeleton before `lotCardBidAction` is ever called:

  ```tsx
  // saleroom-catalog-lots-live.tsx:132-144
  const action = lot.pending ? { kind: "pending" } : lotCardBidAction({...});
  if (action.kind === "pending") return <Skeleton className="h-lax-control-md …" />;
  ```

  `lot.pending` is true for every card until the browser's no-store live read answers (`card-live-state.ts`). That happens on every page load, in production too.
- **Repro.** I set the seeded onsite sale `e1000001` and its 5 lots to `scheduled`, opening tomorrow, then loaded `?view=grid` at 1440:
  - Signed out, every card is first drawn **603px** tall with an action slot. About 400ms later it is **557px** with no slot, so every row drops 46px.
  - It happens signed in (`user1`) too.
  - CLS was 0.020 signed out and 0.027 signed in.
  - The hero offers "Plan your visit / Notify me", so no card button was ever possible.
  - The open hybrid sale `e1000003` stays steady at 635px.
  - On `main` these cards said "Bid", so this jump is new with this PR.
- **Fix.** When `lot.pending`, keep the skeleton only if the sale could offer a button at all. For example, ask `lotCardBidAction` with `viewer: null` and the lot's known status, or apply the same `mayRegister || mayLeaveBid` check, and return `null` otherwise. Add a component test where the lot is `pending` on an onsite sale and expect no action slot.

### The new e2e in CI

- **The CI log.** The `browser-gates` job on `9b71ab2b` (run 44036080346, job 133879270812, success) includes it.
  - The `--list` step names all 6 tests in `[public-chromium] › lot-card-clean-image.spec.ts` (`:133`, `:186`, `:232`, `:256`, `:296`, `:307`) at 07:07:04Z.
  - The gate runs `playwright test --grep "@smoke|@roles" --no-deps --workers=1` with `DATABASE_URL` set, so the scheduled-sale fixture is active.
  - Result: **81 passed, 6 skipped, 0 failed, 0 flaky**.
- **What the log cannot show.** CI uses the dot reporter, which prints no test titles. So the log alone does not name each test's result.
- **How I matched the dots to tests.** I re-ran the identical command locally (`CI=true`, same grep, also 87 tests, list reporter). Here the spec runs at **positions 67–72**. In CI's dot string those six positions are all `·` (passed); CI's skips are at 24, 39–41, 76 and 83.
  - The order is the same: the spec sits between `connectivity-banner` and `marketing-catalog-visibility`. Locally both of those have skips near 74–77.
  - So the five-page walk ran and passed in CI. It was not skipped.
- **My local runs.**
  - The spec alone: 6/6 passed.
  - The full `@smoke|@roles` set: the 6 lot-card tests passed. One unrelated staff `admin-connectivity-banner` test failed locally; I did not run the ws service.
- **Mutation.**
  - I rendered the heart inside the picture box (`absolute right-2 top-2` in `lot-card-media`, removed from the Lot line), rebuilt `web` and re-ran the spec.
  - **3 failed.** The walk failed with `/search?view=grid: controls on a picture`; the desktop and phone tests also failed.
  - I reverted it.
  - Caveat: the seed's home rail shows only sold lots, so `/` carries no heart. The walk proves the heart rule on search, card view, the sale page and the artist page; for home, the unit test proves it.

### Decision 6 in unit tests and e2e

- **Unit tests.**
  - `lot-card-bid-action.test.ts` has 10 cases, covering Bid, Register, KYC, buyer profile, Leave a bid, no advance bid, no placeholder on onsite, and an unknown sale.
  - `saleroom-catalog-lots-live.test.tsx` renders the hero labels on cards.
  - Lot-card, lib/lot-card and saleroom suites: **214/214 passed**.
- **e2e for scheduled lots.** "Register to bid" signed out and "Leave a bid" for `user1` both pass locally and in CI, as above.

### Nits

| Nit | Status |
| --- | --- |
| Duplicated helper | ✅ `lotBidHref` lives in `lib/lot-card/lot-bid-href.ts`, shared by the bidder state and `lotCardBidAction`. |
| Pass-through helper | ✅ `viewerRegisterStep` is gone (grep: 0). |
| Tab order | ✅ Tab from the title link focuses "Quick look at …" on the sale page, search grid, card view and home. The picture link is `tabIndex=-1 aria-hidden`. |
| WebKit | Still not run, by the PR or by me. It is worth one iPad/Safari pass for `(hover: hover) and (pointer: fine)`. |

### Craft (my screenshots, 1440 hover + Tab focus, 1024, 375, light and dark)

- **What is right.**
  - Every lot picture sits on the same mat with the soft shadow. The 4:5 box is the same on the sale page, search grid, search card view and home.
  - The "Lot N" line, title, meta and full-width button line up across each row. On the sale page the meta and button rows stay aligned even when one title wraps to two lines.
  - The quick look pill is centred and clear of the status pill. In dark mode its focus ring is clear (`sale-1440-dark-focus.png`, `search-card-1440-dark-focus.png`).
  - At 375 there is no quick look button at all (0 in the a11y tree and 0 displayed). The heart keeps its 44px target.
  - Type scale is consistent: label xs, title sm/lg, body sm.
- **Minor, not blocking.** Signed in, the sale card shows a taller empty band (about 46px) between the price line and the Bid button than it does signed out (about 20px). It is the same on every card, so rows still align (`sale-1440-light-signed-in-saved.png`), but it reads as a gap.

### Constraints

- **Route JS.** No budget, baseline, ratchet or allowance file is touched (`git diff --name-only` has no matches).
- **Lenis.** Untouched.
- **Commits.** All 9 commits are by `mahmoudamrspace <mahmoudamr.space@gmail.com>`, with no `Co-Authored-By`, `Signed-off-by` or Claude trailers.
- **lax.art and non-lot cards.**
  - No file in `apps/art`, `apps/shop` or `packages/ui` changed, and neither did `marketing-work-card.tsx` itself.
  - The one-frame change applies only when `mediaStyle` is passed, and neither the art nor the shop card passes it.
  - `lot-card.css` is imported only by web's `globals.css`.
- **PR body.** No AI footer. All **22** screenshot URLs (raw.githubusercontent at `9b71ab2b`) return HTTP 200 and render.

### Checklist against the owner decisions (final)

| Decision | Sale page | Search grid | Search card view | Home rails | Artist page |
| --- | --- | --- | --- | --- | --- |
| 1. Only the status pill on the picture | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Heart on the Lot line, outline, 44px, accent | ✅ (accent tested) | ✅ | ✅ | ✅ (no watchable lot in seed; unit test) | ✅ |
| 3. Quick look on hover and focus, none on phones | ✅ | ✅ | ✅ | ✅ | ✅ (e2e walk) |
| 4. One frame | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6. Button names the real next action and agrees with the hero | ✅ labels; ❌ onsite pre-open skeleton → nothing (46px jump) | ✅ Bid only | ✅ Bid only | ✅ | ✅ |
| Budgets, Lenis, commits, PR body | ✅ | | | | |

**To ship:** fix the `lot.pending` skeleton in `saleroom-catalog-lots-live.tsx` so it is not drawn on sales that cannot offer a button, and add a test for it. Nothing else is outstanding.
