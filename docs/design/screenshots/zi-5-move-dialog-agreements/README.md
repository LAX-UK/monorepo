# Move dialogs read the consignor agreement (ZI-5, PR 4)

"Offer at auction" and "Offer on lax.art" in LAX Admin, light and dark, 1440 and 375 px, at 2x.
Named `{view}-{width}-{theme}.png`. Rendered from the real dialog components with fixture data.
Names and terms are made up. Read on 17 November 2026.

- `auction-in-force`: covered by an agreement; the starting price is below the lowest price
  agreed, so a warning shows. No checkbox.
- `auction-expired`, `auction-not-started`, `auction-retired`, `auction-none`: no agreement covers
  LAX Bid; "Add agreement" opens the client page and "Offer at auction" is disabled.
- `auction-no-permission`: someone who cannot read the consignor's agreements: no name, no terms,
  no "Add agreement".
- `auction-no-consignor`: no consignor set; until 31 January 2027 the checkbox is the fallback,
  with "Set consignor".
- `auction-errors`: submitted with two fields wrong: summary above the form and each field.
- `auction-loading`, `auction-error`: the check loading, and failing with "Try again".
- `lax-art-in-force`, `lax-art-expired`: lax.art shows the line and never blocks.

None of the shots scrolls sideways.
