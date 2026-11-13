# PR #1346 · Sellers: show commission and VAT from the signed agreement · round 1

Screenshots of the real seller components in the client workspace layout (organisation: Northbank Gallery, owner), rendered with fixture data through a temporary, uncommitted dev route under `next dev`. Playwright captured them at 1440x900 and 375x812, in light and dark, at 2x scale.

Fixture: hammer £82,000.00 at 15% gives commission £12,300.00, VAT £2,460.00, and you receive £67,240.00. Half-penny case: £333.00 at 12.5% gives commission £41.63.

Branch head at capture: `sc4-seller-wording` (c5e055b3).

| State | 1440 light | 1440 dark | 375 light | 375 dark |
|---|---|---|---|---|
| Sold & payouts: paid out | ![](sold-paid-out-1440-light.png) | ![](sold-paid-out-1440-dark.png) | ![](sold-paid-out-375-light.png) | ![](sold-paid-out-375-dark.png) |
| Sold & payouts: waiting for buyer (After payment) | ![](sold-waiting-for-buyer-1440-light.png) | ![](sold-waiting-for-buyer-1440-dark.png) | ![](sold-waiting-for-buyer-375-light.png) | ![](sold-waiting-for-buyer-375-dark.png) |
| Sold & payouts: being confirmed | ![](sold-being-confirmed-1440-light.png) | ![](sold-being-confirmed-1440-dark.png) | ![](sold-being-confirmed-375-light.png) | ![](sold-being-confirmed-375-dark.png) |
| Sold & payouts: refunded after payout | ![](sold-refunded-after-payout-1440-light.png) | ![](sold-refunded-after-payout-1440-dark.png) | ![](sold-refunded-after-payout-375-light.png) | ![](sold-refunded-after-payout-375-dark.png) |
| Payout page | ![](payout-1440-light.png) | ![](payout-1440-dark.png) | ![](payout-375-light.png) | ![](payout-375-dark.png) |
| Agreement panel | ![](agreement-1440-light.png) | ![](agreement-1440-dark.png) | ![](agreement-375-light.png) | ![](agreement-375-dark.png) |
| Re-offer consent (Agree sheet open) | ![](reoffer-consent-1440-light.png) | ![](reoffer-consent-1440-dark.png) | ![](reoffer-consent-375-light.png) | ![](reoffer-consent-375-dark.png) |
| Re-offer request with its figures | ![](reoffer-figures-1440-light.png) | ![](reoffer-figures-1440-dark.png) | ![](reoffer-figures-375-light.png) | ![](reoffer-figures-375-dark.png) |

The statement PDF, page 1, is rendered from the worker's renderer with `pdftoppm`. A PDF has no dark theme:

![](statement-pdf-page1-a4-light.png)

Notes:
- At 375px, each sold row keeps "£67,240.00 you receive", or "you receive: After payment" or "you receive: Being confirmed", as a phone-only fact beside the hammer.
- The round avatar near the bottom-left in some shots belongs to the dev environment; it isn't part of the page.
