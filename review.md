Verdict: FIX FIRST

# Review of PR #1473: staff kit Views toolbar (GAP-39) and CopyButton / CopyableId (GAP-45)

Branch `staff-kit-toolbar-record-copy` at `9f3bba4f`, reviewed against `origin/main` at `67443083`.

## Findings

1. **BLOCKING. The PR cannot merge and has no CI.** `docs/design/staff-design-standard.md` conflicts
   with main (main's motion tokens commit #1470 edited the same P2 list next to item 5, the
   `CopyButton` line at docs/design/staff-design-standard.md:1635). GitHub reports the PR as
   `mergeable: false` / `dirty`, and the head commit has 0 check runs and 0 statuses, so nothing in
   CI has run on it. Rebase on main (resolving the conflict so the motion item keeps main's wording)
   and let CI run before merging.

2. **BLOCKING. The error state cannot be seen.** packages/staff-ui/src/display/copy-button.tsx:65
   shows the tick only for `copied`; for `failed` the icon stays the copy icon and the only feedback
   is the `sr-only` live region at copy-button.tsx:67. A sighted user whose browser refuses the
   clipboard (insecure context, permission denied, iframe) presses the button and nothing visible
   changes, which reads as "it worked". The brief asks for idle, hover, focus, copied and error states.
   Show a distinct error state for the same 1.5s (for example an alert icon in `text-staff-danger`,
   or the button's tooltip saying "Could not copy"), and add an assertion for it to the
   "says so, and shows no tick, when the browser refuses" test at copy-button.test.tsx:57.

3. `CopyableId` has no call site. It is exported (packages/staff-ui/src/index.ts:63) and tested, but
   nothing renders it, while the standard is moved to `MET` (docs/design/staff-design-standard.md:625)
   and PRD-4 says "the record title's reference also gets a copy button". Either use it in one record
   header, such as the order or payment detail header, or leave PRD-4 as `PARTIAL` with a note
   saying what is still missing.

4. The keyboard test does not use the keyboard. packages/staff-ui/src/display/copy-button.test.tsx:75
   is named "is reachable and operable from the keyboard" but it calls `button.focus()` and then
   `fireEvent.click`. Use `@testing-library/user-event` (`user.tab()`, then `user.keyboard("{Enter}")`
   and `" "`) so the test proves what its name says.

5. A repeat copy is not announced. If the button is pressed again within 1.5s,
   copy-button.tsx:39-41 sets the same `copied` status, so the live region text does not change and
   screen readers stay silent. Clear the message for one tick before setting it again, or add a
   counter key to the `<output>`, so each press is announced.

6. The live region sits outside the component's root. `CopyButton` returns a fragment
   (copy-button.tsx:50-70), so `className` styles only the button, and every `KeyValueList` row with
   `copyValue` now adds its own polite `<output>`. This works because `sr-only` takes it out of flex
   layout. Wrapping both in one `inline-flex` span would let callers position the component as a
   single element. Not blocking.

7. The label is lower-cased mid-sentence. `inSentence` (copy-button.copy.ts:2) lower-cases the first
   letter, so Bid admin's `copyLabel` "Stripe Connect account ID"
   (apps/web/src/lib/admin/stripe-connect-staff-presenter.ts:24) is read as "Copy stripe Connect
   account ID". The old code was worse (it lower-cased the whole label). Consider leaving proper nouns
   alone: only lower-case when the second character is lower case and the word is not in a short
   allow-list, or let callers pass an `actionLabel`.

8. The GAP-39 test checks classes, not layout. packages/staff-ui/src/data/views-menu.test.tsx:479-494
   asserts `min-w-0`, `flex-1` and `shrink-0`. It does fail when `min-w-0` is removed (see the
   mutation check below), so it is a real regression guard. The 375px "never overlaps" claim is
   only covered by a manual Chromium check described in the PR. A small Playwright or browser-mode
   test that measures the tab region and the controls at 375px and 320px would cover it for good.
   Not blocking.

9. The `AdminCopyField` call site changes how it looks (apps/web/src/components/admin/admin-copy-field.tsx:14).
   It was a secondary "Copy" text button with a toast. It is now the 24px ghost icon button with a
   tick and a live region. This matches PRD-4 ("the copy button is 24px, sits after the value"), so
   I accept it, but the PR body should say that the Bid admin reference-ID panel looks different
   and no longer shows a toast.

## What I checked and found sound

- Toolbar (packages/staff-ui/src/data/toolbar.tsx:392-399): the tabs sit in a `min-w-0 flex-1`
  region and the controls in a `shrink-0` one. `OverflowTabs` measures its own `nav.clientWidth`
  with a `ResizeObserver` (packages/ui/src/lax/tabs.tsx), so tabs now overflow into "More" instead
  of pushing under the controls. Every `DataViews` call site renders inside the block `views` slot
  (toolbar.tsx:63), so `flex-1` has the full row. On phones the Views label is `max-sm:sr-only`, so
  its accessible name "Views" stays.
- Sizes and colours come from tokens: `icon-xs` is `size-lax-control-xs` (24px) with
  `rounded-lax-badge`. The icon is `text-staff-subtle`, which is #666969 on #ffffff/#f3f3f2 in light
  and #8c8f8f on #181a1a/#141616 in dark, above 3:1 for a UI graphic in both themes. Focus uses the
  shared LAX button focus ring. No motion tokens or durations change.
- The copy text lives in `copy-button.copy.ts`. The timer is cleared on unmount and on re-press.
- No dependencies were added. The private `KeyValueList` copy button is replaced, so there is no
  route JS growth. No budget or baseline file is touched.
- Commit message and PR text have no Co-Authored-By, Claude-Session or generated-by lines.

## Commands run (on the PR head)

- `pnpm install --frozen-lockfile` and the package builds pass.
- `packages/staff-ui`: `vitest run --maxWorkers=2` passes (80 files, 641 tests). `tsc --noEmit` and
  `biome check src` pass.
- `apps/web` `vitest run --maxWorkers=2 src/components/admin` passes (147 files, 1156 tests).
- `lint:client-copy`, `lint:ui-guardrails`, `lint:staff-route-composition`, `lint:staff-list-template`
  and `lint:staff-legacy-shell` pass. `biome check` on the changed web file passes.
- Mutation check 1: removing `min-w-0` from the tabs region makes "gives the tabs only the room the
  controls leave" fail.
- Mutation check 2: replacing the failure message with `""` makes 2 CopyButton tests fail.
- CI: no check runs exist for `9f3bba4f` because of the merge conflict (finding 1).
- Not run: a full `next build` of apps/web (out of scope), so the route-JS check was not run for
  apps/web. The reasoning for no growth is in the list above.
