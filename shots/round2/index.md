# PR #1356, screenshots round 2 (after the review fixes)

Branch `bk7-bid-invoices-books` at edc4b722. Rendered by a temporary, uncommitted dev route: the real `PurchaseInvoiceCard` inside the real `PurchaseDetail` and `ClientShell`, fed by `purchaseInvoiceCard()` with fixture data only (Northbank Gallery, finance member). `next dev`, Playwright, device scale 2, London time, the page's "now" fixed at Mon 16 Nov 2026 12:00 GMT.

Round 1 (above, before the review) is left as it was; its "refunded" state is gone, since credit notes were removed from this PR.

Changes since round 1: no credit-note row (F5); 'Issued' keeps date and time (Thu 12 Nov, 14:05 GMT, from the issue event: F4); a cancelled invoice gives the day only, "cancelled on Mon 16 Nov" (F11). No horizontal scroll at 375px in any state. The round avatar at bottom left is a dev-only overlay, not part of the page.

| State | 1440x900 light | 1440x900 dark | 375x812 light |
|---|---|---|---|
| preparing | ![](preparing-1440x900-light.png) | ![](preparing-1440x900-dark.png) | ![](preparing-375x812-light.png) |
| delayed | ![](delayed-1440x900-light.png) | ![](delayed-1440x900-dark.png) | ![](delayed-375x812-light.png) |
| issued | ![](issued-1440x900-light.png) | ![](issued-1440x900-dark.png) | ![](issued-375x812-light.png) |
| cancelled | ![](cancelled-1440x900-light.png) | ![](cancelled-1440x900-dark.png) | ![](cancelled-375x812-light.png) |
| lax (Books off, dry run or test organisation: unchanged) | ![](lax-1440x900-light.png) | ![](lax-1440x900-dark.png) | ![](lax-375x812-light.png) |
| issued, long invoice number | ![](issued-long-1440x900-light.png) | ![](issued-long-1440x900-dark.png) | ![](issued-long-375x812-light.png) |

## Email: "Your invoice INV-000123 from LAX Bid"

Rendered with `renderEmail("bid-invoice-issued", …)` from the built package. The logo is a remote image the sandbox could not load.

| Payer, due | Payer, paid | Billing inbox (no name) | Payer, due, 375px |
|---|---|---|---|
| ![](email-due-1440.png) | ![](email-paid-1440.png) | ![](email-billing-1440.png) | ![](email-due-375.png) |
