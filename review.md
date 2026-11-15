Verdict: FIX FIRST

# Review of PR #1474: lax.art FAQ pills, phone price, one enquiry path, contact-band hours

Branch `art-figma-parity-faq-price-hours` at `b7e1b509`, reviewed against `origin/main` at `67443083`.

## Findings

1. **BLOCKING. The radio group holds content that is not radios.**
   packages/marketing-ui/src/marketing-faq-pills.tsx:36 puts `role="radiogroup"` on the row, and
   each answer `<section>` (marketing-faq-pills.tsx:61), with its paragraph and link, renders
   inside that group. A screen reader therefore announces the answer text and the "Plan a visit"
   link as part of a radio group. Each answer `<section>` also has an accessible name through
   `aria-labelledby`, which makes every answer a `region` landmark. A page with 5 FAQs adds 5
   landmarks named after questions. The brief asks for correct roles.
   Fix: drop the explicit `role="radiogroup"`. Wrap the inputs in a `<fieldset>` with a
   `sr-only` `<legend>`, or keep a radiogroup element that contains only the pills. Render the
   answers after the group as plain `<div>`s, shown with
   `group-has-[#id:checked]:block` / `:has()` instead of `peer-checked`. Remove `aria-labelledby`
   from the panels, or make them `div`s, so they are not landmarks. Update the e2e assertion at
   apps/art/e2e/art-journeys.spec.ts:47 to match.

2. **The selected pill looks almost the same as a hovered pill, and the PR says it follows the
   filter-chip tokens but does not.**
   Selected (marketing-faq-pills.tsx:55) is `border-on-surface bg-surface-container-low`. Hover
   (marketing-faq-pills.tsx:54) is `border-on-surface-variant bg-surface-container-low`. The fill is
   identical and only the border differs: #1c170d against #474747 in light, and cream against
   #c9c5bc in dark, where they are hard to tell apart. After a click, moving the pointer onto
   another pill makes two pills look selected. `MarketingFilterChip`
   (packages/marketing-ui/src/marketing-filter-chip.tsx:36-40), whose tokens the PR body says the
   pills follow, uses the product accent border and an accent tint when active. Reuse that
   treatment, ideally as a shared chip class or variant rather than a second copy of the class
   string (which also covers the SOLID/DRY point), and check it against the Figma frame. The PR
   says the frame was not opened. Strongly recommended before merge.

3. The focus ring does not use the shared token. marketing-faq-pills.tsx:56 uses
   `peer-focus-visible:outline-on-surface`, while `FOCUS_RING` (packages/branding/src/marketing-chrome.ts:8)
   and `.art-focus-ring` (apps/art/src/app/base.css:237) use `--color-ring`. The answer link in the
   same component does use `FOCUS_RING`. Use `peer-focus-visible:outline-ring` (with
   `outline-solid`) so every focus ring on the page is the same colour in light and dark.

4. Nothing tests that the chosen answer is shown. As a mutation check I removed `peer-checked:flex`
   from marketing-faq-pills.tsx:64, so no answer is ever visible, and all 3 MarketingFaqPills tests
   and the e2e assertions still pass, because jsdom applies no CSS and the e2e only checks that the
   radio group exists. Add a Playwright step to the artwork journey: the first answer is visible,
   then pressing ArrowRight shows the second answer and hides the first. That also proves keyboard
   operation, which is otherwise only claimed.

5. The "no specialist option" e2e check passes either way. apps/art/e2e/art-journeys.spec.ts:48
   asserts there is no "Contact a specialist" button while the options sheet is closed. The sheet
   (`BottomSheet` / `Sheet` dialogs) does not mount its content while closed, so this check would
   have passed before the change too, and it also runs on the desktop project. Open "More options" in the Pixel 7 project and assert the entry is
   absent, or unit-test `ArtArtworkMobileGallery`'s options list.

6. Nothing tests the phone price order. The `max-md:order-*` classes at
   apps/art/src/app/artworks/[slug]/page.tsx:86, 110, 126, 154 and 158 put the price block after the
   title on phones, but no test checks it. In the mobile e2e project, assert that the price's
   `boundingBox().y` is less than that of the first spec row. The CSS order also differs from the
   DOM order. That is acceptable here, because the moved blocks hold only text and the focus
   sequence still runs title, then price actions, then conversations. Keep it that way.

7. Empty wrappers add a stray gap. The new `max-md:order-4` and `max-md:order-5` wrappers at
   page.tsx:154 and page.tsx:158 always render, but `ArtShopEditions` returns `null` when there are
   no editions (apps/art/src/components/artwork/art-shop-editions.tsx:10). The empty `div` is still
   a flex item, so the summary column gains 24px (`gap-6`) at its foot at every width. Render the
   wrapper only when there is content, or pass `className` into the two components.

8. A comment and a prop are now stale. The comment at
   apps/art/src/lib/artwork/artwork-detail-page.composer.ts:74 still says "Contact a specialist" in
   the mobile options sheet opens the general enquiry form. The `autoOpen` prop of
   `ArtGeneralEnquirySheet` (apps/art/src/components/enquiry/art-general-enquiry-sheet.client.tsx:31,
   50, 61) no longer has a caller. Update the comment and remove the prop and its test usage.

9. Pills have no vertical padding (marketing-faq-pills.tsx:54: `min-h-11 px-4`, no `py`). The
   current questions fit on one line at 375px, but FAQ items can come from help articles
   (`article.question`), and a long question wraps to 2 or 3 lines against the border of a
   `rounded-full` pill. Add `py-2` and `text-left`, and consider `rounded-lax-*`/`rounded-2xl` for
   items that wrap. Not blocking.

10. The FAQ heading copy is inline. The default `title = "FAQs"` is hard-coded in the component, the
    same as the accordion it replaces. `lint:client-copy` passes, so this is within the current rule.
    Moving it into a `marketing-faq.copy.ts` shared by both components would match how copy is
    handled in this repo. Not blocking.

## What I checked and found sound

- No client JavaScript is added. `MarketingFaqPills` has no `"use client"` and its only hook is
  `useId`, so it renders on the server. Native radios give arrow-key and Tab behaviour without
  script, and the `sr-only` inputs stay focusable. The mobile gallery loses the enquiry sheet
  import.
- Route JS, from my own `next build` of apps/art at main and at the PR head, then
  `node scripts/check-route-js-budget.mjs --app apps/art --allow-no-sentry --all`:
  `/artworks/[slug]` went from 517.0 KB to 516.9 KB gzip (page 7.3 to 7.2 KB). The shared frame
  reads 509.6 to 509.7 KB on every route, which is within rounding and build noise. All groups
  pass, and no budget or baseline file is changed. No motion token files are touched.
- Price on request: `priceLabel` comes from `resolveArtworkPriceLabel`, so works on request keep
  their label in the moved block.
- One enquiry path: on phones `ArtArtworkConversations` still offers the specialist enquiry when
  `specialistContact` is ready, so removing the duplicate from the options sheet leaves one path.
- Hours: `buildArtGalleryTeam` already takes hours from the gallery data and hides them when they
  are null or blank (existing test at apps/art/src/lib/gallery-team/art-gallery-team.vm.test.ts:57).
  The new test pins the default text. Because the behaviour was already on main, that test passes
  without this PR. It adds coverage but does not guard anything this PR changed.
- Contrast: the pill border token `--brand-field-edge` is #808080 on #ffffff (about 3.9:1), and
  #858585 on #1a1c1c in dark (about 4.6:1). Pill text is `on-surface`. Both themes pass.
- Commit message and PR text have no Co-Authored-By, Claude-Session or generated-by lines.

## Commands run (on the PR head)

- `pnpm install --frozen-lockfile` and the package builds pass.
- `packages/marketing-ui`: `vitest run --maxWorkers=2` passes (109 files, 696 tests), and typecheck
  passes.
- `apps/art`: `vitest run --maxWorkers=2` passes (102 files, 804 tests), and typecheck passes.
- `biome check` on marketing-ui and apps/art, `lint:client-copy` and `lint:ui-guardrails` pass.
- apps/art `next build` passes at both main and the PR head, and the route-JS check passes (see
  above).
- Mutation check 1: setting `defaultChecked={false}` makes 1 pills test fail, so the test guards the
  initial selection.
- Mutation check 2: removing `peer-checked:flex` leaves every test passing (finding 4).
- CI (REST check-runs on `b7e1b509`): every finished check passes, including `art-browser-gates`.
  `browser-gates` was still running when I looked. The PR is mergeable, and its state is `blocked`
  pending review.
- Not run: the art Playwright e2e locally (no seeded backend here). CI's `art-browser-gates` covers
  it.
