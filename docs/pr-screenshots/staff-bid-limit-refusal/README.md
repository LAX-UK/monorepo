# Staff-placed bid refused at a limit

The clerk console's "Lot on block" panel after a paddle or telephone bid was refused at a limit,
at 1440 px and 375 px, light and dark. File names read `{theme}-{width}-{case}.png`.

| Case | Shows |
| --- | --- |
| `paddle` | Paddle 142 bids £6,000.00 over its £5,000.00 limit for the sale |
| `organisation-limit` | A telephone bid of £9,000.00 stopped at the organisation's £50,000.00 limit, with £5,200.00 left |

Taken from the real panel, hook and command transport on a local dev server. The panel was mounted
on a temporary page (not committed) inside the staff density, and the browser's call to the Bid BFF
was answered with the body the API returns for that refusal (`{ error, code, refusal }`). Sample
data only. The live console itself shows a read-only view below 1024 px; the 375 px shots show
the panel's notice wrapping at phone width.
