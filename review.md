Verdict: SHIP

# Last recheck of PR #1488 "Shop and lax.art: shared empty states"

Reviewed head: `3fac419d` (branch `shop-art-shared-empty-states`). This is the merge of main `46c9bdac` into the previously reviewed head `33cc8483`. Base: `46c9bdac`.

The PR branch was not changed.

**Summary**

- Both open blockers from the last recheck are cleared.
  - The PR description now matches the code, and it has a "Changes after review" section.
  - After the main merge, every Shop, lax.art and Bid (`apps/web`) route group in CI is equal to or below main's latest CI build. The Bid `account` and `checkout` rows that read above main last time now read 0.2 KB below it.
- The PR's own code did not change in the merge. `git diff aef61e26 33cc8483` and `git diff 46c9bdac 3fac419d` are identical apart from hunk offsets in `marketing-ui.css`, `theme.css` and one other file.
- CI is green on `3fac419d`, including `art-browser-gates`. The five local suites pass.

## Blocking

None.

## Non-blocking

- **The docs still say "Static page loads are silent"** (`docs/marketing-design-language.md:121`). lax.art errors default to polite (`apps/art/src/components/art-status-state.tsx:48`). The PR description has it right ("Shop states are silent unless asked; lax.art errors are polite"). The docs should say the same. This was raised last time and is still open.
- **LAX Account (`apps/account`) reads 0.1 KB above main** in CI: account 436.0 → 436.1 KB, page 30.9 → 31.0 KB, frame unchanged. Account uses the kit `EmptyState` (for example `apps/account/src/components/portfolio-empty-state.tsx`), and the kit module grew by about 85 bytes gzip, so this is probably real but tiny. Account was not in the bar for this PR (Shop, lax.art and Bid), its group is `warn` and already over budget on main, and the PR description's table does not list it. A one-line mention in the description would be more complete.
- Carried over and still open, none of them blocking:
  - `apps/shop/next.config.ts:54-76` and `apps/art/next.config.ts:54-75` carry the same `EMPTY_STATE_MODULES` list and `addEmptyStateChunk`. A shared helper would stop them drifting.
  - Shop and lax.art each declare their own `LIVE_ROLES` map (`shop-status-state.tsx:79`, `art-status-state.tsx`, just after `:64`). It could sit next to `packages/ui/src/lax/status-illustration.ts`.
  - The detail-state eyebrow is an `aria-hidden` span inside the h1 (`apps/shop/src/components/artwork/artwork-detail-state.tsx:36-45`). That is fine. A sibling element above the h1 would be cleaner.
- The pre-existing chromium-mobile flake "favourites tabs are signed-in routes" (`apps/art/e2e/art-journeys.spec.ts:237`) still deserves its own ticket. The PR description now documents it.

## Verified

1. **The PR description matches the code (blocker 1: fixed).** Each item the last recheck asked for:
   - **Kit `headingLevel`:** "The page layout is the page's h1 by default but now honours an explicit `headingLevel` … `headingLevel="p"` is also allowed." Matches `packages/ui/src/lax/empty-state.tsx:43` (type `"h1" | "h2" | "h3" | "p"`), `:68` (default `layout === "page" ? "h1" : "h2"`) and `:73`.
   - **`title` as a node:** stated in the description, and used that way by `artwork-detail-state.tsx:35-46`.
   - **`--lax-plate-ink`:** "The plate draws in `text-lax-plate` … Shop and lax.art point `--lax-plate-ink` at … `--color-product-accent`; Bid sets nothing." Matches:
     - `packages/ui/src/lax/theme.css:72`: `--color-lax-plate: var(--lax-plate-ink, var(--lax-fg))`
     - `apps/shop/src/app/base.css:162` and `apps/art/src/app/base.css:182`: `--lax-plate-ink: var(--color-product-accent)`
     - `empty-state.tsx:96`: the plate uses `text-lax-plate`
   - **Removed illustration `size`:** "The `size` it passed to the illustration is gone." That matches the code: `LaxIllustration` no longer gets `size`, and only className widths size it (`empty-state.tsx:103-111`). The layout prop `size` (`default` / `compact`, `:34`) stays, which is correct.
   - **`status-illustration` export:** "`resolveStatusIllustration` … lives next to the kit in `@auction/ui/lax/status-illustration`." Matches `packages/ui/package.json:574-576` and `packages/ui/src/lax/status-illustration.ts`. The old "stays in marketing-ui" claim is gone.
   - **Live regions in the wrappers:** "own their live regions (Shop states are silent unless asked; lax.art errors are polite)." Matches:
     - `apps/shop/src/components/shop-status-state.tsx:54,59,76`: `announcement = "none"`, with a wrapper `role` only when asked
     - `apps/art/src/components/art-status-state.tsx:48,64`: errors default to polite
     - The description no longer claims kit `accent` / `announcement` props.
   - **Forced `lax-empty-state` chunk:** described under "Shared chunk", including `cn` and the focus ring. Matches `apps/shop/next.config.ts:54-76` (utils and `marketing-chrome` patterns at `:58-60`, `enforce: true` at `:75`) and `apps/art/next.config.ts:54-75`.
   - **`MarketingStatusAction` phone rule:** "stacks full width, one per row, on phones (below 40rem), as before." Matches `packages/marketing-ui/src/marketing-ui.css:387-393` (`max-width: 39.99rem`, `flex: 1 1 100%; width: 100%`). "As before" is accurate: main stacked these actions full width under the same breakpoint (main `marketing-ui.css`, the `max-width: 39.99rem` block around `:594-601`). The reduced-motion block is at `:351-359`. The old "CSS is unchanged" claim is gone.
   - **One h1:** described under "Changes after review" item 2, with the page tests. Matches `apps/shop/src/app/basket/page.test.tsx:33-36` and `apps/art/src/app/for-artists/apply/page.test.tsx`.
   - **Route JS table:** every number matches the two CI logs it cites. See item 2 below.
   - **Art mobile flake note:** in Evidence and in "Changes after review" item 4, citing main's run 43833229661.
   - **"Changes after review" section:** present, items 0-5.
   - Other claims checked:
     - Shop's `state.css` title overrides are removed (`git diff 46c9bdac 3fac419d -- apps/shop/src/app/state.css`: 14 lines deleted). `state.css` itself stays.
     - `.shop-detail__eyebrow`, `MarketingStatusState` and `ShopStateMotif` have no remaining references in `apps`, `packages` or `docs`.
     - The local suite counts in the description (shop 725, art 809, ui 681, marketing-ui 707) match my runs exactly.
2. **Route JS is at or below main for Shop, lax.art and Bid after the main merge (blocker 2: fixed).** Main's latest CI build is merge-queue run 43835866524, job 133192743466, head `46c9bdac`, which is the PR's base. The PR CI build is run 43844435778, job 133221416022, head `3fac419d`. Largest route per group, gzip KB:

   | app / group | main | PR | Δ |
   |---|---|---|---|
   | web account | 545.4 (frame 442.7) | 545.2 (frame 442.6) | −0.2 |
   | web checkout | 471.9 (frame 441.1) | 471.7 (frame 441.0) | −0.2 |
   | web listing | 462.1 | 462.1 | 0 |
   | web lot | 467.4 | 467.4 | 0 |
   | web public | 394.5 | 394.5 | 0 |
   | web sale | 478.8 | 478.7 | −0.1 |
   | shop account | 520.3 | 517.1 | −3.2 |
   | shop checkout | 551.7 | 548.9 | −2.8 |
   | shop product | 552.8 | 550.0 | −2.8 |
   | shop public | 520.4 | 518.1 | −2.3 |
   | art account | 522.0 | 521.2 | −0.8 |
   | art product | 524.0 | 523.2 | −0.8 |
   | art public | 527.7 | 526.9 | −0.8 |

   - Bid duplicates are unchanged: 133 (33.3 KB) on account and 94 (22.7 KB) on checkout.
   - The tracked routes are equal or lower: Home 394.5 = 394.5, Sale page 478.8 → 478.7, Lot page 467.4 = 467.4. All are under their ratchets.
   - Both builds compare the same base code, so this is a like-for-like comparison and no noise argument is needed.
   - No budget, ratchet or baseline file is in the PR diff.
3. **The code did not regress since the last recheck.**
   - The only new commit is the merge `3fac419d`. Its one conflicted file, `packages/marketing-ui/src/marketing-ui.css`, keeps main's #1486 hover and press changes. The PR's hunk there still only removes the old status-state CSS and adds the phone rule. No hover, press, `hang` or transition lines from #1486 are touched.
   - The PR's diff against its base is byte-for-byte the same as at `33cc8483`, apart from hunk offsets.
4. **CI on `3fac419d`:** all 41 check runs completed with success, including `ci-result`, `build`, `test`, `browser-gates`, `account-browser-gates`, `art-browser-gates` (job 133221082998), the 8 web vitest shards, shop-api, api, `shop-v1-phase-smoke` and the contract jobs. GitHub reports `mergeable_state: clean`.
5. **Unit suites, run locally at `3fac419d`** after building the workspace dependencies:
   - `packages/ui`: 86 files, 681/681
   - `packages/marketing-ui`: 111 files, 707/707
   - `apps/shop`: 118 files, 725/725
   - `apps/art`: 103 files, 809/809
   - `apps/web`: 1527 files, 9983 passed, 10 skipped, 0 failed
6. **Earlier verified items still hold.** The merge did not touch these files:
   - one h1 per page, with h2 under a page-owned h1
   - reduced motion
   - phone stacking
   - the dark accent contrast check (`scripts/ci/verify-status-pill-contrast.test.mjs`)
   - Bid opt-in behaviour: Bid sets no `--lax-plate-ink`, and `alerts/stop` and `alerts/confirm` keep h1
