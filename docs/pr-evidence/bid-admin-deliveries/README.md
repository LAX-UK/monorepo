# Bid admin Deliveries, D9 PR 2 (GAP-47)

The real `/admin/deliveries` page from `next dev`, served by a stand-in for the Bid API that
answers with made-up deliveries in the shape of the merged read API (#1517), at 1440 × 1000 and
375 × 812, light and dark, at 2× pixel density. Named `{state}-{width}-{theme}.png`. All names,
addresses and sales are made up. The dev-only query devtools button is hidden.

| State | Scenario |
| --- | --- |
| `01-waiting` | Fulfilment, Waiting for a price, three requests (as in the approved mockup) |
| `02-waiting-panel` | The queue panel on Lot 42, "1 of 3": beside the list at 1440, full screen at 375 |
| `03-quoted` | Quoted tab |
| `04-to-dispatch-panel` | Booked, not dispatched, with Awaiting payment, panel open |
| `05-on-the-way` | On the way, with courier and tracking in the Waiting column |
| `06-on-the-way-panel` | Panel with the Delivery section; dispatch says "Time not recorded" |
| `07-delivered` | Delivered tab ("Delivered", no made-up time) |
| `08-closed` | Closed: Withdrawn by buyer, Cancelled, Collected in person |
| `11-empty` | Nobody waiting for a price |
| `12-no-results` | A search that matches nothing |
| `13-error` | The API did not answer: error with Try again |
| `14-loading` | First load skeleton |
| `15-not-found` | D6: `?record=` names a lot with no delivery; Notice with "Back to the list" |
| `16-changed-while-open` | D6: the buyer withdrew while the panel was open; Notice after the refresh |

There is no read-only state: D5 gives Deliveries exactly to the roles that can open Lot
fulfilment, and today all of them can also price, so no role sees View only yet (the code path is
kept and unit tested for a read-only Lot fulfilment capability).

No state scrolls sideways at 375 (checked on each capture).

The same journey runs in CI against the seeded stack ("Run Bid admin Deliveries journey" in
`.github/workflows/e2e-pr.yml`); its screens are the `deliveries-journey-screens` artifact.
