Verdict: SHIP

# Review of PR #1506 "Storage tab: polish" (register ST-3F1)

Head reviewed: c85b51ed (2 commits) against main dd81f7f2. Review is static plus the 38 CI check runs
on the head SHA, plus the screenshots opened one by one. I could not run vitest or the mutations
locally: the review checkout has no installed dependencies. The mutation claims below are
reasoned from the code, not executed. CI confirms the tests pass with the change, not that they fail without it.

## Blocking

None.

## Non-blocking

1. Redundant message. With charging off, the card now says the same thing three times: the page
   notice "Charging is off" (screenshot 1440 light, top), the switch off, and the new empty state
   "No storage invoices are being raised". It does fill the card, which was the goal. Consider
   whether a lighter filler would do. Not worth holding the PR.
2. Wording when the switch cannot be turned on. The body "Nothing is invoiced until the switch
   above is on." (storage-copy.ts:94-95) sits under the "Can be switched on once Finance chooses a
   VAT treatment" reason in the same card. It is accurate. Read-only staff get no switch at all,
   only an Off value (storage-cards.tsx:166-173), so "the switch above" points at a row that reads
   "Raise storage invoices: Off". Slightly loose, still true.
3. Large blank area in the scheduled state. charging-off-scheduled-1440-light.png: Charging takes
   the full width and the empty state adds about 190px of mostly white space. It reads as
   intentional kit spacing, but it is the weakest screenshot.
4. 375 screenshots do not show the change. charging-off-375-light/dark.png are true 375x812
   viewports and cut off inside the Charging card, above the new empty state. They prove "no
   horizontal scroll" only. A scrolled capture of the card at 375 would evidence the
   off state on mobile. The scheduled 375 shots have the same limit.
5. date-input.tsx:118/135 passes `now ?? mountedAt`. When `now` is given, `mountedAt` is unused, so
   the useState initializer reads `new Date()` once for nothing in that case. It would be tidier
   to put `now` in the initializer only. Harmless.
6. The README says "rendered from the real components", fine. It does not record the fixture
   date, so the "Since Sun 1 Nov" text in the shots will age. Cosmetic.
7. SSR note: the clock is now read once per mount, so server and client could differ at a midnight
   boundary (a hydration warning on the placeholder). Admin staff pages, extremely unlikely, same exposure as before.

## Verified

- Charging card off state: `<EmptyState size="compact" headingLevel="h3" ...>` is added
  under the switch only when `charging.raiseInvoices` is false
  (apps/web/src/components/admin/collections/storage/storage-cards.tsx:180-187). `EmptyState`
  is the staff kit component, already imported in storage-panel.tsx:10 and used with
  `size="compact"` elsewhere (sales-tab.tsx:17, overview-tab.tsx:152). Nothing else in the card
  or the page is restyled: the diff to storage-cards.tsx is 9 added lines, 0 deleted.
- Screenshots, opened and judged. At 1440 light and dark
  (charging-off-1440-*.png) the Charging card now matches the In force card height
  (both end at about y=449), and the empty state is centred and balanced. Type scale is consistent:
  the staff-sm muted body, a semibold title, and a kit icon. Dark mode contrast is fine and the
  border and colours follow the tokens. At 375 the cards stack with no horizontal scroll and
  consistent 16px gutters. The scheduled state is correct and full width.
- Charging behaviour, amounts and reminder wording are unchanged. Only 5 lines were added to
  storage-copy.ts (:92-96, a new `offState` key). No existing string, rate, VAT logic, switch
  handler, `blockedReason` (storage-cards.tsx:143-144) or reminder copy is touched. Amounts in the
  screenshots (£3.00 / £6.00, £3.50 / £7.00) come from the existing fixtures.
- Copy is in a copy file (storage-copy.ts), not inline in the component. The component only reads
  `C.charging.offState.*`. Staff kit only; no new bespoke styles or classNames in the diff.
- SOLID: the change is additive and local. The card still has one job. `DateInput` gains an optional
  `now` prop (open for tests, closed for existing callers), and `dateInputExample`
  (date-input.tsx:74-84) already took an injected `now`, so it is unchanged and still pure.
- dateInputExample no longer reads the clock per render. `DateInput` now holds
  `React.useState(() => now ?? new Date())` (date-input.tsx:107-108), so the clock is read once
  on mount. The old line, `dateInputExample(min, max)` evaluated every render, is gone
  (date-input.tsx:135). No other non-test callers of `dateInputExample` exist (grep).
- Mutation (reasoned, not executed):
  - Removing the EmptyState block fails storage-panel.test.tsx:47-62 on the heading query.
  - Dropping the `raiseInvoices ?` guard fails its second half (`queryByText(...)` toBeNull) once charging is on.
  - Reverting to a per-render clock fails date-input.test.tsx:91-109: the second `setSystemTime`
    plus `rerender` would flip the placeholder to "10 Mar 2027".
  - Removing the `now` prop fails the injected-clock assertion (date-input.test.tsx:110-119,
    "2 Jan 2030"), which is not the real date.
  The date test fakes only `Date`, restores real timers in `finally`, and calls `cleanup()`
  between renders, so it is deterministic and does not leak.
- Route JS: no new imports into the route (EmptyState was already imported by storage-panel.tsx),
  budgets.json and scripts/route-js-* are untouched by the diff (14 files: 3 source, 2 tests, 8
  screenshots, 1 README), so budgets were not raised. CI `build` passed. I did not rerun the
  budget gate; I am relying on CI.
- CI: 38 check runs on head c85b51ed, all success or skipped (skipped: shop-v1-phase-smoke,
  account-browser-gates, art-browser-gates, which are path-scoped). ci-result, build, test, web
  vitest 1-8/8, ui-chromium and browser-gates are green.
- PR body has no AI footer, trailer or "generated with" line. The commits carry no Co-Authored-By
  or Claude-Session trailer (checked both commit messages).
- No PR comments were posted and the PR branch was not changed.
