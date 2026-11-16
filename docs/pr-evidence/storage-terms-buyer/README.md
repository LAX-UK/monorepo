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
The `lot` and `shipping` shots, at both widths and in both themes, were retaken after the merge
review, from the same dev server with a stub API for the public lot and the place terms, and with
the cookie banner, the dev indicator and the floating avatar hidden. The shipping page now shows the
place's terms without the old general "storage charges may apply" sentence, which only appears
while no place has terms. The `booking` shots are unchanged.
