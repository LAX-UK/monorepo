# PR #1366, Zoho Books: Shop invoices (rehearsal), screenshots, round 1

Branch `bk10-shop-invoices`.

## How these were made

- **Route.** A temporary dev route, never committed, at `apps/shop/src/app/dev-shop-invoice/[state]/page.tsx`. It renders the real `ShopOrderDetail` (with the new `ShopOrderInvoiceCard`) inside the real `ShopAccountShell`, the same tree as `/account/orders/[orderId]`.
- **Server.** `next dev` on port 3020.
- **Data.** Fixture data only: order `LAX-S-10482`, invoice `LAX-INV-000124`. The order is one print at £450 with a £120 frame and £25 UK delivery, £595 in total.
- **The card's input.** The real view-model, `shopOrderInvoiceCard`, fed the API's card shape for each state. "Now" is fixed at Thu 12 Nov 2026, 15:00 GMT.
- **Capture.** Playwright Chromium, full page, `deviceScaleFactor: 2`.
- **Dark mode.** The Shop's own `html.dark` class.
- **Horizontal scroll.** None in any shot: `scrollWidth - innerWidth = 0` in all 15 page shots.
- **The "N" bubble** is the Next.js dev indicator, not part of the page.

## The card's states

| State | When | 1440×900 light | 1440×900 dark | 375×812 light |
|---|---|---|---|---|
| Preparing | Books issues live; not yet issued with LAX's copy, under 30 min | [light](shots/round1/preparing-1440-light.png) | [dark](shots/round1/preparing-1440-dark.png) | [375](shots/round1/preparing-375-light.png) |
| Delayed | The same, after 30 min (announced with `<output>`) | [light](shots/round1/delayed-1440-light.png) | [dark](shots/round1/delayed-1440-dark.png) | [375](shots/round1/delayed-375-light.png) |
| Issued | Number, "Issued Thu 12 Nov, 14:05 GMT" (from the issue event), and "Download invoice (PDF)" from LAX's stored copy | [light](shots/round1/issued-1440-light.png) | [dark](shots/round1/issued-1440-dark.png) | [375](shots/round1/issued-375-light.png) |
| Cancelled | Refunded in full; the day only ("This invoice was cancelled on Mon 16 Nov. You owe nothing on it.") | [light](shots/round1/cancelled-1440-light.png) | [dark](shots/round1/cancelled-1440-dark.png) | [375](shots/round1/cancelled-375-light.png) |
| Unchanged | Dry run, test_org or Books off: no Invoice panel, and LAX's own "Download invoice (PDF)" stays under "Help with this order", exactly as before | [light](shots/round1/lax-1440-light.png) | [dark](shots/round1/lax-1440-dark.png) | [375](shots/round1/lax-375-light.png) |

While Books issues the invoice (any state but unchanged), LAX's own invoice button is no longer offered under "Help with this order". The Invoice panel replaces it.

## The email

Subject: **Your invoice LAX-INV-000124 from LAX Shop**. It is rendered by the real `renderEmail("shop-invoice-issued", …)`, with the stored PDF attached by key.

- [1440 light](shots/round1/email-1440-light.png)
- [375 light](shots/round1/email-375-light.png)

## For the owner

The Bid card's "being prepared" line is "You can pay now. We'll email your invoice as soon as it's ready." A Shop order is already paid, so the Shop card shows only the second sentence. Please confirm this.
