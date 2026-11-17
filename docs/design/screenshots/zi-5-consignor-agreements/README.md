# Consignor agreements on the client page (ZI-5, PR 2)

Screenshots of the Agreements section on a LAX Admin client page (`clients/[partyId]`), light and
dark, 1440 and 375 px, at 2x. Named `{view}-{width}-{theme}.png`. Rendered from the real
components with fixture data. Names and terms are made up. The page is read on 17 November 2026.

- `agreements`: in force (with a long note), not started, expired and retired, in that order.
- `empty`, `loading` (section skeleton while it streams in) and `error` (Try again).
- `read-only`: Gallery staff (account manager) read agreements and open the signed file, with no
  Add, Replace or Retire.
- `catalogue-editor`: someone who keeps agreements but cannot read clients sees the consignor's
  name and Agreements only.
- `add-dialog-errors`: Add agreement submitted empty, problems in the summary and beside fields.
- `replace-dialog`: the next version starts from the current terms and keeps the signed file.
- `retire-dialog`: the confirmation.

None of the shots scrolls sideways.
