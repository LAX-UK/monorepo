Verdict: FIX FIRST

# Recheck of PR #1473: staff kit Views toolbar (GAP-39) and CopyButton / CopyableId (GAP-45)

Branch `staff-kit-toolbar-record-copy` at `0ef9eb02` (unchanged since 21:45 UTC), against `origin/main` at `67443083`.
First review was at `9f3bba4f`.

## Findings

1. **BLOCKING. CI is red: an existing apps/web test fails.** `web vitest (8/8)` fails on
   apps/web/src/components/admin/admin-user-profile-panel.test.tsx:66 ("shows IDs in full as copyable
   facts"): it looks for a button named "Copy user id", but `KeyValueList.copyValue` now uses
   `CopyButton`, whose name comes from `inSentence` (packages/staff-ui/src/display/copy-button.copy.ts:2)
   and reads "Copy user ID". Reproduced locally (`vitest run --shard=8/8`: 1 failed, 1089 passed); the
   same test passes on `origin/main`. The new wording is the intended one, so update the test to
   "Copy user ID" and "Copy current identity session ID" (line 69), and search apps/web for other
   `/Copy .* id"/` queries. The first review missed this; it was already broken at `9f3bba4f`.

2. **Repeat-copy announcement is not tested, and the fix is fragile.** packages/staff-ui/src/display/copy-button.tsx:81
   remounts the `<output>` on each press (`key={presses}`). A live region inserted with its text
   already in it is often not announced (NVDA/JAWS and VoiceOver announce changes to a region that
   already exists). Removing `key={presses}` leaves all 7 CopyButton tests green (mutation check
   below), so nothing guards it. Keep one `<output>` mounted and clear its text, then set it on the
   next frame (or toggle a trailing zero-width/non-breaking space), and add a test that two presses
   inside 1.5s produce two text changes. Not blocking, but first-review finding 5 is only partly fixed.

3. First-review finding 3 is still open: `CopyableId` has no call site, while PRD-4 is `MET`
   (docs/design/staff-design-standard.md:625) and P2 item 5 is Done (line 1639). Use it in one record
   header (order or payment detail) or mark PRD-4 `PARTIAL` with a note. Not blocking.

4. First-review finding 4 is still open: the keyboard test (packages/staff-ui/src/display/copy-button.test.tsx:86)
   still calls `fireEvent.click` after `focus()`. Use `user-event` (`tab`, `{Enter}`, `" "`). Not blocking.

5. First-review finding 7 is still open: "Stripe Connect account ID" is read as "Copy stripe Connect
   account ID" (copy-button.copy.ts:2, apps/web/src/lib/admin/stripe-connect-staff-presenter.ts:24).
   Not blocking.

6. First-review finding 6 (fragment root, one `<output>` per KeyValueList row) and finding 8 (GAP-39
   test checks classes, not measured layout) are unchanged. Both were non-blocking; still are.

7. The doc comment at packages/staff-ui/src/display/copy-button.tsx:17 now runs past the line width the
   rest of the block keeps (Biome passes, but rewrap it). Nit.

## First-review findings now fixed

- 1 (merge conflict, no CI): main merged with a normal merge; item 5 Done and item 6 keeps main's wording. CI now runs (and finds finding 1 above).
- 2 (invisible error state): failed shows `CircleAlert` in `text-staff-danger` for 1.5s and returns to rest; the test asserts icon, class and reset. Mutation check: swapping the alert icon back to the copy icon fails the test.
- 9 (AdminCopyField look change): now stated in the PR body.

## What I checked and found sound

- Shared components live only in packages/staff-ui; `KeyValueList` and `AdminCopyField` reuse `CopyButton`, no per-app copies.
- Copy text in `copy-button.copy.ts`; `lint:client-copy` passes.
- `text-staff-danger` is a staff token defined for light and dark; focus ring is the shared LAX button ring; 24px `icon-xs`. Toolbar layout at 375px unchanged from the first review (sound).
- Commit messages and PR body: no Co-Authored-By, Claude-Session or generated-by lines.

## Commands run (on `0ef9eb02`)

- `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: pass.
- `packages/staff-ui`: `vitest run --maxWorkers=2` 641/641 pass; `tsc --noEmit` and `biome check src` pass.
- `apps/web`: `vitest run --shard=8/8 --maxWorkers=2`: 1 failed (finding 1); same file on `origin/main`: 6/6 pass.
- `lint:client-copy`, `lint:ui-guardrails`, `lint:staff-route-composition`, `lint:staff-list-template`, `lint:staff-legacy-shell`: pass. Biome on admin-copy-field.tsx: pass.
- Mutation checks: alert icon reverted → 1 test fails; `key={presses}` removed → 0 tests fail (finding 2).
- CI (`gh pr checks` via REST check-runs): `web vitest (8/8)` failure; web vitest 1-7, api, shop-api, contracts, docker images pass; `build` and `browser-gates` still running at 21:59 UTC.
- Not run: a full `next build` of apps/web (out of scope).
