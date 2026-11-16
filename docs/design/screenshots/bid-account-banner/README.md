# Account prompt and sale bottom bar

Captures of the running Bid web app (`next start` on a production build) with mocked data: the
sale "Spring sale" and its lots come from a mock API, and the signed-in calls (session, account
menu, sale viewer) are answered with the app's own response shapes, so the app's client code
chooses every label. Mocked person "Alex Example"; no real people. 375 and 1440 px wide, light
and dark, named `{state}-{width}-{theme}.png`.

The person in the incident: identity check approved, registered for the sale, with one purchase
held by checks.

- `header-chip-held`: the header chip at 1440 says "Payment on hold"; the hero says "You're
  registered" and offers no Register button.
- `phone-strip-held`: the phone strip says "Payment on hold · See why"; the bottom bar offers View
  lots.
- `phone-strip-documents`: "Payment on hold: documents needed" fits the strip at 375.
- `phone-strip-closed`, `header-chip-closed`: a rejected or archived organisation reads "Payments
  closed for this account".
- `bottom-bar-*` (scrolled past the hero's actions): the bar offers exactly the hero's action.
  Registered: View lots. Buyer agent not registered: Register to bid (to the form on the page).
  Identity check not done: Verify identity to bid. Signed out: Register to bid (sign-up, back to
  the sale).
- `before-*`: the same person on main: "Account in review", and the bar offering "Register" to
  the create-account page while the hero says "You're registered".
