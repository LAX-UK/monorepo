# Bid admin Deliveries: list page and queue panel (GAP-47, D9 PR 2)

The real `/admin/deliveries` page from `next dev`, served by a fixture-backed stand-in for the
Bid API (signed in as a made-up Fulfilment user), at 1440 × 1000 and 375 × 812, light and dark,
at 2× pixel density. Named `{state}-{width}-{theme}.png`. All names, addresses and sales are made
up. The dev-only overlays (Next.js and TanStack Query devtools buttons) are hidden in the shots.

| State | Scenario |
| --- | --- |
| `01-waiting` | Waiting for a price, three requests (as in the approved mockup); tab and nav counts |
| `02-waiting-panel` | The queue panel beside the list at 1440 ("1 of 3"); Status, Price and Waiting stay in view |
| `03-quoted` | Quoted tab |
| `04-to-dispatch-panel` | Booked, not dispatched, with Awaiting payment, panel open |
| `05-on-the-way` | On the way, with courier and tracking in the Waiting column |
| `06-on-the-way-panel` | Panel with the Delivery section; the dispatch step says "Time not recorded" |
| `07-delivered` | Delivered tab; no delivery time is recorded, so the column says "Delivered" alone |
| `08-closed` | Closed: Withdrawn by buyer, Cancelled (a refunded purchase), Collected in person |
| `08b-closed-collected-panel` | A lot collected in person, dated from when it was collected |
| `11-empty` | Nobody waiting for a price |
| `12-no-results` | A search that matches nothing, with Clear filters |
| `13-error` | The API did not answer: error with Try again, no tab counts |
| `14-loading` | First load skeleton |
| `15-not-found` | A lot in the URL with no delivery: "This delivery could not be found", Back to the list |
| `02b-long-title-panel` | A long destination beside the panel: the Lot title and sale line wrap, never cut |
| `16-load-error` | The lot's read failed (not a 404): "This delivery could not be loaded. Try again." with Try again |
| `17-denied` | The Bid API refused the read: the kit's access-denied state, no Try again |

### Second round (after the review of #1520)

`01`–`08b`, `12`, `15`, `16` and `17` were re-shot after the review, against the local stack as
`e2e-stabilization` builds it (Postgres 16, migrations, `db:seed:local`, API, auth issuer and
`next dev`), signed in as the seeded Operations (Fulfilment) user, with a few made-up delivery
requests added to the throwaway local database. The lot thumbnails show as broken images only
because that sandbox cannot reach the seed's image host. `16` and `17` were made by a temporary,
uncommitted stub in the web reader that threw a 500 for one lot id and "forbidden" for one search,
because a live API cannot be made to fail on cue there. `11`, `13` and `14` have no rows and are
unchanged from the first round.

In this round the Lot column takes the room the others leave and wraps the title and its sale
line instead of cutting them, and on a phone the status takes its own line under the title.

No state scrolls sideways at 375 (checked on each capture).

The View only states (`09`, `10` in the first round) are not shot: under D5 read access is exactly
Lot fulfilment access, and today every role that can read Lot fulfilment can also write it, so no
real role sees View only. The View only panel and list stay covered by unit tests.
