Verdict: SHIP

# Final recheck: PR #1454 (deploy-skew-recovery)

This recheck covers head `8602640e` ("Detect unsaved input in the stale-build recovery snippet from edit events"), measured against the previous recheck of `7776b1d2`.

## Status of the previous findings

- **Finding 1 (BLOCKING, unsaved input in React-controlled fields): fixed.**
  - **How it works now.** `dirty()` no longer depends on comparing `value` with `defaultValue`. Capture-phase `input`/`change` listeners on `window` record an edit for any editable field (`chunk-load-recovery-snippet.client.ts:46`). While an edit is recorded on the current path, the page counts as dirty. The mark is cleared on `submit`/`reset`.
  - **Tests with real React.** `chunk-load-recovery-snippet.react.client.test.tsx` renders a React 19 controlled input in jsdom and shows that `value === defaultValue` after typing. It then shows that typing, moving focus away, marking the build stale and hiding the tab does not reload. A control test confirms the page does reload when nothing was typed.
  - **Mutation check.** Each of these makes the suite fail:
    - removing the `input` listener;
    - removing the `change` listener;
    - removing both;
    - removing the edit check in `dirty()`;
    - making `field()` always false;
    - ignoring the path rule.
- **Finding 2 (visibility gating untested): fixed.** Reloading on every `visibilitychange` is now caught by a test.
- **Finding 3 (other guards untested): fixed.** Removing any one of these guards now fails a test:
  - the checkbox/radio check;
  - the `<select>` check;
  - the `pagehide` listener;
  - the in-flight `busy` flag.
- **Finding 4 (`leaving` sticks): fixed.** It is cleared on `pageshow` and one second after `beforeunload`, and both changes are covered by tests.
- **Finding 5 (dialog check too broad): fixed.** The check is narrowed to `[role="dialog"][data-state="open"]`, `[aria-modal="true"]` and `[aria-busy="true"]`. I checked against the real `@auction/ui/lax/dialog` (Radix) rendered open in jsdom: it matches the selector (`role="dialog"`, `data-state="open"`). So the bid dialog still blocks the hidden-tab reload.
- **Finding 6 (link handler overriding anchors): documented** in the comment.
- **Finding 7 (staging HEAD check): still open**, as the PR body says.

## Invariants

- **No reload while dirty or while a bid is being placed.** The page does not reload while:
  - a field has focus;
  - an edit is recorded;
  - an open dialog is present (this covers the bid dialog) or `aria-busy` is set;
  - a form was submitted in the last 15 seconds;
  - a checked or selected value differs from its default.
- **Reloads happen only in two cases:** on `visibilitychange` to hidden, or as a full navigation on the next same-origin link click. Never while the page is leaving.
- **The 10-minute guard is intact.** The claim is still required (removing it fails 2 tests), the legacy key is still read, and the key is shared with the socket recovery.
- **The inline script is still in the CSP.** It is in `INLINE_HEAD_SCRIPTS`, which middleware hashes (`apps/web/src/middleware.ts:40`), and the inline-head-scripts test covers it. It is rendered by a server component (`chunk-load-recovery-init.tsx`). The script is now 3,404 bytes on every HTML response.
- **Route JS is unchanged.** The only client-module change is the key constants and the legacy-key read in `socket-chunk-recovery.client.ts`. CI `build`, which runs the route JS budgets, is green.
- **No AI attribution.** None of the three commits or the PR text has a `Co-Authored-By`, `Claude-Session` or generated-by line.

## Local results and CI

- **Local results:**
  - vitest for `src/lib/csp`, `socket-chunk-recovery` and `middleware` (`--maxWorkers=2`): 65/65 passed.
  - biome is clean on the 9 changed files.
  - `check-layers` passes.
  - `tsc --noEmit` reports only the one existing unresolved `@auction/api/app` module error, in a file this PR does not touch.
- **CI on `8602640e`:** every check passed, including `static-checks`, `build`, `browser-gates`, web vitest 1–8, the docker images and `ci-result`. The matrix and art/account browser gates were skipped.

## Findings

1. **Non-blocking: any form submit clears every recorded edit.** At `apps/web/src/lib/csp/chunk-load-recovery-snippet.client.ts:46`, the `submit` listener clears the edit mark for the whole page, not only for the form that was submitted. Suppose a different form on the same page is submitted, for example a header search that stays on the page, or a newsletter sign-up. Once the 15-second window passes, unsaved typing in a controlled field elsewhere no longer counts as dirty. If the field has also lost focus, a hidden tab can then reload over that typing. Removing the clear-on-submit survives the suite, so nothing tests it. A fix: keep the mark per form, or clear it only when the submitted form contains the edited field.
2. **Non-blocking: the open-dialog selector is not pinned by a test.** In the fake-window test (`chunk-load-recovery-snippet.client.test.ts:148`), `querySelector` returns an element for any selector. Removing `[role="dialog"][data-state="open"]` from the selector, or removing `[aria-busy="true"]`, still passes the suite. The bid dialog has no `aria-modal`, so it relies on the `data-state` part. Add a React test that renders the real dialog open and expects no reload.
3. **Non-blocking: a slow navigation can reopen the reload window.** `leaving` is cleared one second after `beforeunload`, even when that navigation is still in progress. An example: a cross-origin link click, or a download, whose response takes more than a second. If the person switches tab in that time, a hidden-tab reload can replace the pending navigation. This is narrow, and it fails towards loading the current build. Consider clearing `leaving` only on `pageshow`, or once focus or visibility returns.
4. **Non-blocking: the PR description's Summary is out of date.** It still says the page "reloads once" when a file is missing and the script is "about 1.2 KB". The script is now deferred and about 3.4 KB. The "Changes after review" sections are accurate.
5. **Non-blocking, still open:** confirm on staging that the edge/CDN does not answer `HEAD` for a missing chunk with a cached 200 or an HTML fallback.
