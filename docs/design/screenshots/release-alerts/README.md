# Release alerts: send log, Leads figures and the publish choice

Playwright screenshots for LA-3 (`docs/design/staff-gaps-delivery-zoho-alerts.md`, L1, L2, L5 and
the L6 screenshot plan), taken from a running LAX Admin stack (the CI browser-gate set-up:
migrated, `db:seed:local`, demo top-up roles) on production builds. True viewport captures at
1440 × 1000 and 375 × 812, light and dark, at 2x, named `{state}-{width}-{theme}.png`. No
horizontal scroll at 375 px in any of them.

Data: the six fixture releases `seed:release-alert-sends` writes (one per status), plus, for these
captures only, 412 confirmed and 9 pending release-alert subscribers and five draft works. Every
name and title is made up; subscriber addresses are `@example.com` and never shown.

Send log (Leads › Release alerts):

- `send-log`: one row per status: Sent, Sending, Not sent yet, Not announced, Queued, Counts not
  kept. Every column, the 56px `…` last, fits the card at 1440 with no sideways scroll. The
  Sending release has a long title, cut short on its row. At 375 each row reads edition, status
  and "Emailed N of M"; Queued and Not announced show only their badge (no "Emailed 0 of 0").
- `send-log-long-title`: the long-titled release's panel: the title wraps in the header, and the
  place, ↑ ↓ and "Open artwork" stay on screen.
- `send-log-panel`: a Sent release opened from its row: place in the list, published time and
  publisher, the counts, and why one was not sent. "Open artwork" for a role that can open it.
- `send-log-panel-stuck`: a release with a digest unsent for more than a day, with its notice in
  the danger tone.
- `send-log-panel-off-page`: a panel link to a release that is not on the page shown (the page
  just after it): it is read on its own and opens, with no place to step from (PRD-7).
- `send-log-panel-not-found`: a panel link naming no release in the log: the panel says so.
- `empty`: no release published yet (L5 copy).
- `loading`: skeleton rows while the log loads (the list's next render held back), the same
  columns as the table, fitting the card.
- `error`: the read failed (an invalid page cursor): the frame stays, with Try again.
- `permission-denied`: the operations role, which cannot read leads, opening the address.

Today's Leads figures and the publish choice (L6):

- `leads-count`: the two figures above the leads list, 412 confirmed and 9 awaiting.
- `leads-count-empty`: nobody confirmed: "Nobody has confirmed yet".
- `publish-tell-subscribers`: the editor's Publish dialog for an edition release, ticked.
- `publish-not-edition`: the same dialog for an original: no checkbox.
- `publish-toast`: after publishing: "Release alert queued for 412 subscribers." The toast does
  not cover any dialog button (the dialog has closed), and the count matches `leads-count`.
- `bulk-publish`: the artworks list with 3 editions selected and the bulk Publish dialog.
