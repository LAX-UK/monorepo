Verdict: FIX FIRST

Review of PR #1513 "Quick look: Back closes it and View lot sits at the top" at head `b7e58845`. I did not change the PR branch.

The design is right and most of it works. In a real Next 15.5.21 app-router build, Back closes the quick look, and closing with X or Escape leaves no stale entry. Two quick looks in a row and Back twice also behave, and View lot followed by Back lands on the list at the same scroll position. One bug sits in the "open then reload" edge from the brief: after a reload, Back stops closing the quick look. The fix is a couple of lines. The tests also miss the `replace` behaviour that View lot and Bid depend on.

## How this was checked

- Ran `vitest run src/components/marketing/lot-quick-look`: 26/26 pass.
- Proved the tests fail without the change. I stubbed `useQuickLookHistory` to a no-op that keeps the exported key, and all 6 new history tests fail. Some of them fail only by timing out while they wait for a `popstate` (see finding 4).
- Removed `replace` from both View lot and Bid as a mutation. All 26 tests still pass (finding 4).
- Read how Next 15.5.21 handles history (`app-router.js`: the patched `pushState`, `onPopState`, `HistoryUpdater`, and `preserveCustomHistoryState` per reducer). Copying `window.history.state` (which carries `__NA` and the tree) is the right way to keep the router consistent. Back and the hook's own `history.back()` both dispatch a restore that keeps the custom state, so the router state is not corrupted and nothing navigates twice.
- Built a minimal Next 15.5.21 production app that runs the PR's `use-quick-look-history.ts` verbatim. Its quick-look provider sits in the layout, as `MarketingLotQuickLookShell` does, and it has a View lot `Link replace` and an ordinary in-dialog `Link`. I drove it with Playwright (Chromium). Results:
  - Client navigation home → sale, open, Back, Back: closes, then home. Pass.
  - Hard load, open, X, Back: home, so no stale entry. Pass.
  - Escape, then reopen at once (two in a row), Back, Back: closes, then home. Pass.
  - X, then reopen before the step back lands, X, Back: home. Pass.
  - Open, View lot, Back: sale page at the same `scrollY`. Back again: home. Pass.
  - **Open, reload, open again, Back: the quick look stays open.** Fail (finding 1).
  - Open, reload, Back: Back does nothing visible once (finding 2).
  - Open, Back, Forward, Back: Forward lands on a dead entry (finding 2).
  - Open, click an in-dialog link that is not View lot or Bid: the quick look stays open over the new page and leaves an extra entry (finding 3).
- CI is green on the head commit. `browser-gates` ran `test:e2e:pr` with 70 tests (64 passed, 6 skipped); main had 69 (62 passed, 7 skipped), so the new `@smoke` spec ran and passed. `check:route-js-budget` ran in `build` and passed. Only 7 files change, and no budget, baseline or allowance file is among them.
- The new hook, the footer and the meta panel are imported only by `lot-quick-look-dialog.tsx`, which loads through `next/dynamic` with `ssr: false`, so the history code is in the lazy chunk. The `packages/ui` change is a type only. The lot card is untouched, and the analytics calls (`emitQuickLookCta('view_lot' | 'bid')`, deck nav) are unchanged.
- The four screenshots on `pr-assets/quick-look-back@8b9a5134` (1440 and 375, light and dark) are linked in the body. View lot is in the first row and in view at both widths, and the list shows dimmed behind. The body and both commits carry no AI footer or trailer.

## Findings

1. **After a reload, Back no longer closes the next quick look** (correctness, blocker). `apps/web/src/components/marketing/lot-quick-look/use-quick-look-history.ts:8` and `:45-47`, compared at `:72`.
   `entrySeq` is a module counter that starts at 0 on every page load, so the id is unique only within one load. Open a quick look (entry id 1), reload, and open another: it pushes id 1 again, on top of the leftover entry that is also id 1. Pressing Back lands on that leftover entry. `currentEntryId() === entryIdRef.current` is true, so the handler returns and the quick look stays open: Back appears to do nothing. Pressing X next calls `history.back()` once more. I reproduced this in the harness (Back result: `{"path":"/sale","key":1,"dlg":true}`).
   Fix: make the id unique across loads and set it on the pushed state rather than the counter:
   ```ts
   const pageLoadId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
   // in push():
   entrySeq += 1;
   entryIdRef.current = `${pageLoadId}:${entrySeq}`;
   window.history.pushState({ ...base, [QUICK_LOOK_HISTORY_KEY]: entryIdRef.current }, "");
   ```
   Change `useRef(0)` to `useRef("")`. With exactly this change the harness passes: Back after a reload closes the quick look, and every other scenario above still passes. Add a unit test that pre-seeds `history.state` with `{ [QUICK_LOOK_HISTORY_KEY]: <what the first push would use> }` before opening, then asserts that Back closes the quick look.

2. **A reload, or Forward after Back, leaves one dead history step** (UX, should fix or document). `use-quick-look-history.ts:69-77`.
   - After open then reload, the current entry still carries the quick-look key with the dialog closed, and the hook is not mounted because the chunk is lazy. The first Back stays on the same URL and nothing changes, so the visitor presses Back twice.
   - Back then Forward re-enters the quick-look entry without reopening it, which leaves the same dead step.
   Fix, either of:
   - (a) Accept it and list both cases under "residual risk" in the PR body.
   - (b) Store the lot id in the pushed state (`{ [KEY]: id, lotId }`). When the dialog sees `popstate` land on an entry that carries the key with no quick look open, it reopens that lot, or calls `history.back()` when it can't. This keeps the code in the lazy chunk. Don't add an eager check to the shell; that would grow route JS.

3. **In-dialog navigations other than View lot and Bid keep the quick look open and leave an extra entry** (correctness, should fix). `quick-look-dialog-sections.tsx:343` (the "Conditions of Sale" `Link`) and `components/marketing/watchlist-heart-button.tsx:76` (the signed-out heart's `router.push(loginHref)`).
   The provider lives in `(marketing)/layout.tsx`, and nothing closes the quick look when the route changes. A click on Conditions of Sale goes to the terms page with the quick look still open over it. History becomes list → list (quick look) → terms. The first Back shows the list with the quick look still open, the second closes it, and only the third leaves. If the visitor closes it with X on the terms page instead, the hook does not step back (the current entry has no key), and the dead entry stays. The same mechanism explains the residual risk the PR names (Back pressed while the chunk is still loading opens the quick look on the previous page).
   Fix: record the pathname when the quick look opens, for example `session.openedAt = window.location.pathname` in `openQuickLook` (`lot-quick-look-context.tsx:46`); it's a few bytes in an existing eager module. In the dialog, close and call `releaseHistoryForNavigation()` when `usePathname()` differs from it. Also send the Conditions link through `handleCtaNavigate` with `replace` (or open it in a new tab), and do the same for the heart's sign-in push. That gives them the same history behaviour as View lot.

4. **The tests don't pin the behaviour that makes "Back from the lot page returns to the list" work** (test coverage, blocker). `lot-quick-look.test.tsx:492-505`; `quick-look-footer.tsx:46` and `:71`.
   With `replace` removed from both View lot and Bid, all 26 tests still pass. In that state, Back from the lot page lands on the leftover quick-look entry, which is the dead step from finding 2. The View lot test calls `preventDefault()` on the click (`:496`), so it never exercises `next/link`. With the hook stubbed it fails only on its own clean-up step (the `history.back()` wait at the end), not on its assertion. The history tests also share jsdom's history across tests (the length keeps growing), so they depend on order.
   Fix:
   - (a) Add the View lot journey to `e2e/quick-look-back.spec.ts`: open, click View lot, wait for the lot URL, `goBack()`, then expect the sale URL and the same `scrollY`, with the dialog hidden.
   - (b) In the unit test, mock `next/link` or assert that the rendered anchor goes through `replace`. Or spy on the router's `replace` through the app-router mock used elsewhere in the suite.
   - (c) Reset history in an `afterEach` with `history.replaceState(null, "")` and a fresh `vi.spyOn` per test.

5. **The e2e covers only the hard-load, first-entry case, and the PR body misdescribes the failure mode** (test coverage, should fix). `e2e/quick-look-back.spec.ts:18` and `:33`.
   `page.goto(sale.path)` makes the sale page the first entry, so without the change `goBack()` does nothing. The test does fail then, but because the dialog stays visible, not because "Back leaves the sale page" as the body says. Nothing in it checks that exactly one entry is added, or that closing with X leaves none behind.
   Fix: start at `/` and reach the sale page by clicking a link (client navigation, as the brief requires). After the first `goBack()` and its assertions, call `goBack()` again and expect the previous page's URL; this proves there is exactly one entry. Add a variant that closes with the X and then calls `goBack()` once, expecting the previous page. Correct the sentence in the body.

6. **Router refresh or server action while the quick look is open drops the key, leaving a stale entry** (robustness, nice to have). `use-quick-look-history.ts:59`.
   In Next 15.5, `refresh-reducer`, `server-action-reducer` and `server-patch-reducer` set `preserveCustomHistoryState = false`, so `HistoryUpdater` writes a state without `__laxQuickLook`. After that, closing with X skips `history.back()` because the key is gone. Today the modal makes this unlikely: the consent banner's `router.refresh()` can't be reached behind it, and the watchlist uses `fetch`. Dev HMR does trigger it.
   Fix: also record `window.location.href` at push time. On a non-Back close, step back when `pushedRef` is set and the href is unchanged, even if the key is gone. Alternatively, put a comment on the hook stating the assumption.

7. **Light-mode status chip in the screenshots looks washed out** (visual, verify only). `quick-look-1440-light.png` and `quick-look-375-light.png`: the "Wed 16 Dec" chip shows as light text on a grey block, while the dark shots look normal. The status band is not in this diff, so this is probably a capture artefact (the stagger animation or a text selection), but please confirm. Also check 375×667 (iPhone SE): with the 85dvh sheet and the 42dvh image, View lot should still clear the sticky footer, but none of the PR's evidence shows that height.

## Things that need no change

- Exactly one entry per open, and none for lot-to-lot deck steps (the deck changes `session`, not `open`).
- X, Escape, backdrop, "Back to results" and the mobile swipe-close all go through `handleOpenChange(false)` and step back once.
- Opening a link with a modifier key or in a new tab still steps back, because `navigatesHere` is false for it.
- Focus returns to the trigger on Back on desktop: the e2e asserts it, and Radix `onCloseAutoFocus` is unchanged.
- Escape and scroll lock are unchanged.
