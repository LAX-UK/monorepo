# Storage terms 4/7: buyer surfaces

Screenshots of the buyer surfaces at 1440 px and 375 px, light and dark. File names read
`{theme}-{width}-{surface}.png`.

| Surface | Shows |
| --- | --- |
| `lot` | "Collection and storage" section on the lot page |
| `shipping` | The Storage section of the shipping page |
| `purchases-list` | List badges: upcoming, soon, charging (with total), charging off, extended, waived |
| `notice-*` | The purchase notice in each state: upcoming, soon, charging, charging off, extended, waived |
| `booking` | The booking page summary with "Storage to pay" |

They were taken from the real components, fed by the real formatter, on a local dev server with a
stub API. Payment cleared Mon 2 Nov 2026, 14 days free at £3 a day, so the collect-by day is
Mon 16 Nov. The 375 px `purchases-list` and `notice-*` shots were retaken after review, with the cookie banner,
the dev indicator and the floating avatar hidden; the running total now wraps onto its own badge.
The other 375 px shots (`lot`, `shipping`, `booking`) are unchanged components and still show the
site's cookie banner; they were not retaken because their stub API is not part of the repository.
