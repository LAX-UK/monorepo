# Accounting page screenshots, round 4

PR #1342, branch `books6-accounting-page` at `60ccd2c9` (Accounting: let the phone meta line wrap).

How they were made: as in round 3. The real `AccountingQueueList`, rendered with fixture data through a temporary, uncommitted dev route inside the real `FinanceShell`, under `next dev`. Captured with Playwright at 2x pixel density. Dark shots set both `prefers-color-scheme: dark` and the app's theme (`lax_theme=dark` cookie, `dark` class and `data-theme` on `<html>`). The dev-only overlays and the cookie banner are hidden. The fixture data is made up. Relative times ("12 minutes ago") are against the capture time.

This round re-renders only the phone (375x812) list states touched by the fix. Names follow `<state>-375-<theme>.png`.

| State | What it shows | Files |
| --- | --- | --- |
| `tab-needs-person` | Needs a person tab: locked-period row with Try again (its meta line wraps to two lines), a contact-ambiguous row, and a row that cannot be tried again | [375/light](tab-needs-person-375-light.png) [375/dark](tab-needs-person-375-dark.png) |
| `tab-failed` | Failed tab: four refused documents, each with Try again; every meta line wraps after the dot and the time is whole | [375/light](tab-failed-375-light.png) [375/dark](tab-failed-375-dark.png) |
| `tab-waiting` | Waiting tab: Queued, Sending and Checking Books rows, no actions; the meta line fits on one line | [375/light](tab-waiting-375-light.png) [375/dark](tab-waiting-375-dark.png) |
| `tab-issued` | Issued today tab with Books numbers | [375/light](tab-issued-375-light.png) [375/dark](tab-issued-375-dark.png) |
| `rehearsal-issued` | Issued today tab in rehearsal: "Rehearsal, not in Books" rows | [375/light](rehearsal-issued-375-light.png) [375/dark](rehearsal-issued-375-dark.png) |

## What changed since round 3

- **375, meta line**: "Tried 2 times · last Thu 12 Nov, 09:30 GMT" no longer ends in an ellipsis where a row's Try again button narrows the column. It wraps, first after the dot, so the date and time stay whole on the second line. Same size and muted colour as before. Where there is room (Waiting, Issued today, rehearsal, and the needs-person rows without a button) it stays on one line. In the browser, no meta line in these ten shots overflows its box.
- The change is in the Accounting page only (`MetaLine` in `accounting-queue-list.tsx`, `rowMetaParts` in the view model). The shared staff kit's meta slot still truncates for other lists.

## Seen while capturing

- A queued document that has not been sent yet reads "Tried 0 times" on the phone meta line, and Waiting rows show "None" in the problem line. Both are existing copy, not part of this fix.
