# Bid admin Deliveries, PR 1 (GAP-47)

The real `/admin/deliveries` page from `next dev`, served by a fixture-backed stand-in for the
Bid API, at 1440 × 1000 and 375 × 812, light and dark, at 2× pixel density. Named
`{state}-{width}-{theme}.png`. All names, addresses and sales are made up.

| State | Scenario |
| --- | --- |
| `01-waiting` | Fulfilment, Waiting for a price, three requests (as in the approved mockup) |
| `02-waiting-panel` | The queue panel on Lot 42, "1 of 3" |
| `03-quoted` | Quoted tab |
| `04-to-dispatch-panel` | Booked, not dispatched, with Awaiting payment, panel open |
| `05-on-the-way` | On the way, with courier and tracking in the Waiting column |
| `06-on-the-way-panel` | Panel with the Delivery section and history |
| `07-delivered` | Delivered tab |
| `08-closed` | Closed: Withdrawn by buyer and Cancelled |
| `09-read-only` | Read-only staff: View only in the header |
| `10-read-only-panel` | Read-only panel: View only, no link to Lot fulfilment |
| `11-empty` | Nobody waiting for a price |
| `12-no-results` | A search that matches nothing |
| `13-error` | The API did not answer: error with Try again |
| `14-loading` | First load skeleton |

No state scrolls sideways at 375 (checked on each capture).
