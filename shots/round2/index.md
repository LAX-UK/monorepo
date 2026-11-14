# Accounting page screenshots, round 2

PR #1359, branch `bk8-books-payments` at `112a3bf2`, after the fixes for the review findings (F1 to F10).

## How they were made

- The real `AccountingQueueList` and `AccountingDetailsSheet` components, rendered with fixture data inside the real `FinanceShell`, through a temporary, uncommitted dev route under `next dev` (removed afterwards).
- Playwright at 1440x900 (light and dark) and 375x812 (light), device scale 2.
- Dark shots set `prefers-color-scheme: dark` and the app's theme (`lax_theme=dark` cookie, `dark` class and `data-theme` on `<html>`).
- Dev overlays, the TanStack Query devtools button and the cookie banner are hidden.
- Every capture was checked for horizontal page scroll: there was none, at any size.
- The fixture data is made up.

Files are `<state>-<width>-<theme>.png`.

## States

| State | What it shows | Finding |
|---|---|---|
| `needs-person` | Needs a person: the "Bank transfers part received" panel (details in the muted text token), a parked delivery invoice, a parked Pay several payment, and a payment parked because its invoice was cancelled. Each parked row offers **Release**; none offers Try again. The status badge has room before "Last problem". | F1, F10 |
| `needs-person-empty-panel` | The same tab with no part-received transfers: the panel is not shown at all. | F10 |
| `needs-person-delivery-details` | The parked delivery invoice's details: the notice is titled "Waiting for the accountant" once and its text starts "VAT on delivery."; the footer action is Release. | F1, F5, F8 |
| `needs-person-paysev-details` | The parked Pay several payment's details and what it is applied to (£1,543.20 + £333.33 + £45.01 = £1,921.54). | F5 |
| `needs-person-cancelled-details` | The payment parked for a cancelled invoice: "Refund the buyer, or reinstate the invoice in Bid and press Release." | F8 |
| `needs-person-release-dialog` | The Release confirm dialog. | F1 |
| `waiting` | Waiting tab: a payment held by a failed invoice ("Waiting for LAX-BID-INV-… · Failed") and a payment queued behind an invoice not sent yet. | F4 |
| `waiting-held-details` | Details of the payment held by the failed invoice: no "Last problem" (it was never tried), an info notice "Not sent yet", and "Waiting for" naming the invoice and its state. | F4, F5 |
| `waiting-queued-details` | Details of a queued payment never tried: no "Books gave no reason.". | F5 |
| `failed-holding-payment` | Failed tab: the refused invoice that holds the payment above, with Try again. | F10 |
