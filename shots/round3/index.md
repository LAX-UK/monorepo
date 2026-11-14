# PR #1366, Zoho Books: Shop invoices (rehearsal), screenshots, round 3

Branch `bk10-shop-invoices` at `34b933fc`, after the recheck fixes (N6 copy). Fixture data only.

## How these were made

- **Route.** As in rounds 1 and 2: a temporary dev route, never committed, rendering the real `ShopOrderDetail` and `ShopOrderInvoiceCard` inside the real `ShopAccountShell`, fed the API's card shape through the real view-model `shopOrderInvoiceCard` (now given `outsideUk` from the order's fulfilment, as the order page does). "Now" is fixed at Fri 20 Nov 2026, 12:00 GMT.
- **Data.** Order `LAX-S-10482`: a print at £450 with a £120 frame. Outside-UK: £85 delivery outside the UK (£655). Refunded: £25 UK delivery (£595), refunded Mon 16 Nov. Invoice `LAX-INV-000124`.
- **Capture.** Playwright Chromium, full page, `deviceScaleFactor: 2`; dark is the Shop's own `html.dark`. No horizontal scroll in any shot (`scrollWidth - innerWidth = 0` in all six). The "N" bubble is the Next.js dev indicator.

## New copy (the owner can change it later)

| Where | Text |
|---|---|
| Invoice card, order delivered outside the UK (being prepared, late, issued) | "Delivery outside the UK is invoiced separately." |
| "Help with this order", refunded order with Books' invoice in the card | LAX's own document is now "Order receipt (PDF)" (was a second "Download invoice (PDF)") |

## Shots

| State | What the buyer sees | 1440×900 light | 1440×900 dark | 375×812 light |
|---|---|---|---|---|
| Outside-UK order | Summary £655. The card shows `LAX-INV-000124` (goods and frame, £570), issued, "Delivery outside the UK is invoiced separately.", and its download. | [light](outside-uk-1440-light.png) | [dark](outside-uk-1440-dark.png) | [375](outside-uk-375-light.png) |
| Refunded order | The card stays issued with "Download invoice (PDF)" and "A refund was made on Mon 16 Nov.". Under "Help with this order", LAX's own document is "Order receipt (PDF)". One "Download invoice (PDF)" on the page. | [light](refunded-1440-light.png) | [dark](refunded-1440-dark.png) | [375](refunded-375-light.png) |
