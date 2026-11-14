# Accounting page screenshots, round 1

PR #1359, branch `bk8-books-payments` at `5c0ec376`.

## How they were made

- The real `AccountingQueueList` and `AccountingDetailsSheet` components, rendered with fixture data inside the real `FinanceShell`, through a temporary, uncommitted dev route under `next dev`.
- Playwright at 1440x900 (light and dark) and 375x812 (light), device scale 2.
- Dark shots set `prefers-color-scheme: dark` and the app's theme (`lax_theme=dark` cookie, `dark` class and `data-theme` on `<html>`).
- Dev overlays are hidden.
- Every capture was checked for horizontal page scroll: there was none, at any size.
- The fixture data is made up.

Files are `<state>-<width>-<theme>.png`.

## States

| State | What it shows |
|---|---|
| `needs-person` | Needs a person. The "Bank transfers part received" panel (a single transfer and a Pay several transfer). A parked delivery invoice and a parked Pay several payment ("Waiting for the accountant"). A payment parked because its invoice was cancelled. No Try again on any parked row. |
| `needs-person-paysev-details` | The details sheet of the parked Pay several payment: why it waits, and "Applied to", with each invoice and the delivery invoice to the penny (£1,543.20 + £333.33 + £45.01 = £1,921.54). |
| `needs-person-delivery-details` | The details sheet of the parked delivery invoice. |
| `waiting-paysev-details` | Waiting tab: a Pay several payment queued behind its invoices (£33.33 + £33.33 + £33.34), with "Sent once each invoice it pays is in Books." |

## Changes made while taking these

- At 1440 the "Waiting for the accountant" badge overran the Status column. The column is now 176px; the Last problem column's minimum went from 220px to 180px so that the table still fits without scrolling.
- The delivery row's label is now "Delivery · Pay several", so it fits under the reference.
