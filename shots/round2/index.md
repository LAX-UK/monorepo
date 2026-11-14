# PR #1366, Zoho Books: Shop invoices (rehearsal), screenshots, round 2

Branch `bk10-shop-invoices`, after the review fixes (F6, F8). Fixture data only.

## How these were made

- **Route.** As in round 1: a temporary dev route, never committed, rendering the real `ShopOrderDetail` and `ShopOrderInvoiceCard` inside the real `ShopAccountShell`, fed the API's card shape through the real view-model `shopOrderInvoiceCard`. "Now" is fixed at Fri 20 Nov 2026, 12:00 GMT.
- **Fixture quirk fixed.** Every print line now carries `editionSummary` as shop-api describes it: "No. 7 of 24 · Hand-signed · Certificate from the artist" while the order holds the print, and "Limited edition of 24 · Hand-signed · Certificate from the artist" once it is refunded (shop-api names no number then). Round 1's refunded shot had no summary, so the old fallback "Edition of 24" showed.
- **Email.** Rendered by the real `renderEmail("shop-invoice-issued", …)` to HTML, then captured. The template declares `color-scheme: light` only (as Bid's does), so the dark capture is the light email under a dark browser preference.
- **Capture.** Playwright Chromium, full page, `deviceScaleFactor: 2`; dark is the Shop's own `html.dark` (theme cookie). No horizontal scroll in any shot (`scrollWidth - innerWidth = 0`). The "N" bubble is the Next.js dev indicator.

## The card's new states

| State | What the buyer sees | 1440×900 light | 1440×900 dark | 375×812 light |
|---|---|---|---|---|
| Outside-UK order | £450 print, £120 frame, £85 delivery outside the UK (£655). The card shows the order's invoice `LAX-INV-000124` (goods and frame, £570) with its download. The delivery is invoiced on its own and parked for the accountant; nothing about it is on the card. | [light](outside-uk-1440-light.png) | [dark](outside-uk-1440-dark.png) | [375](outside-uk-375-light.png) |
| Refunded order | A refund does not cancel the invoice: the card stays issued with "Download invoice (PDF)" and adds "A refund was made on Mon 16 Nov.". LAX's own invoice (which states the refund) stays under "Help with this order". Round 1 showed this as "Invoice cancelled". | [light](refunded-1440-light.png) | [dark](refunded-1440-dark.png) | [375](refunded-375-light.png) |

## The email

Subject: **Your invoice LAX-INV-000124 from LAX Shop**. The total is now the attached invoice's own gross. For a UK order that is the order total (£595.00); for an outside-UK order it leaves out the separately invoiced delivery (£570.00 against £655.00).

| Email | 1440×900 light | 1440×900 dark | 375×812 light |
|---|---|---|---|
| Account holder (link to `/account/orders/<id>`) | round 1 | [dark](email-1440-dark.png) | round 1 |
| Guest (link to `/orders/guest`, which mails a fresh link) | [light](email-guest-1440-light.png) | [dark](email-guest-1440-dark.png) | [375](email-guest-375-light.png) |
