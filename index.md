# Review screenshots: PR #1349, round 1

Staff: seller proceeds, settlement preview and recording signed agreements.

- **How they were made:**
  - A temporary dev route, not committed, rendered the real components inside the real staff shell (Bid admin navigation, fixture Administrator).
  - All data is invented fixture data: Northbank Gallery Ltd, Lot 21 "The Lock Keeper's House", and so on. No real people or accounts.
  - Pages came from `next dev` and were captured with Playwright.
- **Sizes:**
  - 1440×900 light, 1440×900 dark and 375×812 light, at 2× pixel density.
  - Pages are captured full length. Dialogs and the side panel are captured at viewport size.
- **File names:** `<state>-<width>-<theme>.png`.
- **Accessibility:**
  - axe (WCAG 2.0/2.1/2.2 A and AA) ran on every state at 1440 in light and dark: 66 checks, no violations. The results are in `axe.json`.
  - The first pass flagged the loading skeletons. They are fixed in the PR.
- **What is not product UI:**
  - The round icon at the bottom left is the Next.js dev-mode indicator.
  - The first-visit cookie banner was hidden for the captures.
  - In the lot views, the header, Lot numbers, Photos and Pricing rows are simplified stand-ins around the real Seller proceeds section and held notice.

## Lot page: Seller proceeds section

| State | 1440 light | 1440 dark | 375 light |
|---|---|---|---|
| Waiting for the buyer | [open](shots/round1/lot-waiting-1440-light.png) | [open](shots/round1/lot-waiting-1440-dark.png) | [open](shots/round1/lot-waiting-375-light.png) |
| Ready for payout | [open](shots/round1/lot-ready-1440-light.png) | [open](shots/round1/lot-ready-1440-dark.png) | [open](shots/round1/lot-ready-375-light.png) |
| Paid out 13 Nov ("Seller received") | [open](shots/round1/lot-paid-1440-light.png) | [open](shots/round1/lot-paid-1440-dark.png) | [open](shots/round1/lot-paid-375-light.png) |
| Raised under the old rule, recalculated under the agreement | [open](shots/round1/lot-recalculated-1440-light.png) | [open](shots/round1/lot-recalculated-1440-dark.png) | [open](shots/round1/lot-recalculated-375-light.png) |
| Re-awarded at a new hammer | [open](shots/round1/lot-reawarded-1440-light.png) | [open](shots/round1/lot-reawarded-1440-dark.png) | [open](shots/round1/lot-reawarded-375-light.png) |
| LAX-owned stock | [open](shots/round1/lot-lax-owned-1440-light.png) | [open](shots/round1/lot-lax-owned-1440-dark.png) | [open](shots/round1/lot-lax-owned-375-light.png) |
| Refunded after payout | [open](shots/round1/lot-refunded-1440-light.png) | [open](shots/round1/lot-refunded-1440-dark.png) | [open](shots/round1/lot-refunded-375-light.png) |
| Sold through ATG: settle by hand | [open](shots/round1/lot-atg-1440-light.png) | [open](shots/round1/lot-atg-1440-dark.png) | [open](shots/round1/lot-atg-375-light.png) |
| Bid company not VAT-registered | [open](shots/round1/lot-not-vat-1440-light.png) | [open](shots/round1/lot-not-vat-1440-dark.png) | [open](shots/round1/lot-not-vat-375-light.png) |
| Loading | [open](shots/round1/lot-loading-1440-light.png) | [open](shots/round1/lot-loading-1440-dark.png) | [open](shots/round1/lot-loading-375-light.png) |
| Could not load | [open](shots/round1/lot-error-1440-light.png) | [open](shots/round1/lot-error-1440-dark.png) | [open](shots/round1/lot-error-375-light.png) |
| Held notice in the lot header and the held section | [open](shots/round1/lot-held-1440-light.png) | [open](shots/round1/lot-held-1440-dark.png) | [open](shots/round1/lot-held-375-light.png) |

### Waiting for the buyer

![Waiting for the buyer, 1440 light](shots/round1/lot-waiting-1440-light.png)

### Ready for payout

![Ready for payout, 1440 light](shots/round1/lot-ready-1440-light.png)

### Paid out 13 Nov ("Seller received")

![Paid out 13 Nov ("Seller received"), 1440 light](shots/round1/lot-paid-1440-light.png)

### Raised under the old rule, recalculated under the agreement

![Raised under the old rule, recalculated under the agreement, 1440 light](shots/round1/lot-recalculated-1440-light.png)

### Re-awarded at a new hammer

![Re-awarded at a new hammer, 1440 light](shots/round1/lot-reawarded-1440-light.png)

### LAX-owned stock

![LAX-owned stock, 1440 light](shots/round1/lot-lax-owned-1440-light.png)

### Refunded after payout

![Refunded after payout, 1440 light](shots/round1/lot-refunded-1440-light.png)

### Sold through ATG: settle by hand

![Sold through ATG: settle by hand, 1440 light](shots/round1/lot-atg-1440-light.png)

### Bid company not VAT-registered

![Bid company not VAT-registered, 1440 light](shots/round1/lot-not-vat-1440-light.png)

### Loading

![Loading, 1440 light](shots/round1/lot-loading-1440-light.png)

### Could not load

![Could not load, 1440 light](shots/round1/lot-error-1440-light.png)

### Held notice in the lot header and the held section

![Held notice in the lot header and the held section, 1440 light](shots/round1/lot-held-1440-light.png)

## Settlement run

| State | 1440 light | 1440 dark | 375 light |
|---|---|---|---|
| Loading the preview | [open](shots/round1/settle-loading-1440-light.png) | [open](shots/round1/settle-loading-1440-dark.png) | [open](shots/round1/settle-loading-375-light.png) |
| Preview: 3 ready, Lot 21 held, totals, finance notice at the top | [open](shots/round1/settle-sales-1440-light.png) | [open](shots/round1/settle-sales-1440-dark.png) | [open](shots/round1/settle-sales-375-light.png) |
| Confirm: Pay £72,228.50 to Northbank Gallery Ltd now? | [open](shots/round1/settle-confirm-1440-light.png) | [open](shots/round1/settle-confirm-1440-dark.png) | [open](shots/round1/settle-confirm-375-light.png) |
| Every sale held: Nothing can be paid yet | [open](shots/round1/settle-all-held-1440-light.png) | [open](shots/round1/settle-all-held-1440-dark.png) | [open](shots/round1/settle-all-held-375-light.png) |
| Nothing to settle | [open](shots/round1/settle-nothing-1440-light.png) | [open](shots/round1/settle-nothing-1440-dark.png) | [open](shots/round1/settle-nothing-375-light.png) |
| This entity already has an open payout | [open](shots/round1/settle-open-payout-1440-light.png) | [open](shots/round1/settle-open-payout-1440-dark.png) | [open](shots/round1/settle-open-payout-375-light.png) |
| VAT setting missing | [open](shots/round1/settle-vat-missing-1440-light.png) | [open](shots/round1/settle-vat-missing-1440-dark.png) | [open](shots/round1/settle-vat-missing-375-light.png) |

### Loading the preview

![Loading the preview, 1440 light](shots/round1/settle-loading-1440-light.png)

### Preview: 3 ready, Lot 21 held, totals, finance notice at the top

![Preview: 3 ready, Lot 21 held, totals, finance notice at the top, 1440 light](shots/round1/settle-sales-1440-light.png)

### Confirm: Pay £72,228.50 to Northbank Gallery Ltd now?

![Confirm: Pay £72,228.50 to Northbank Gallery Ltd now?, 1440 light](shots/round1/settle-confirm-1440-light.png)

### Every sale held: Nothing can be paid yet

![Every sale held: Nothing can be paid yet, 1440 light](shots/round1/settle-all-held-1440-light.png)

### Nothing to settle

![Nothing to settle, 1440 light](shots/round1/settle-nothing-1440-light.png)

### This entity already has an open payout

![This entity already has an open payout, 1440 light](shots/round1/settle-open-payout-1440-light.png)

### VAT setting missing

![VAT setting missing, 1440 light](shots/round1/settle-vat-missing-1440-light.png)

## Payouts

| State | 1440 light | 1440 dark | 375 light |
|---|---|---|---|
| List: Hammer and Net columns, the five views | [open](shots/round1/payouts-list-1440-light.png) | [open](shots/round1/payouts-list-1440-dark.png) | [open](shots/round1/payouts-list-375-light.png) |
| Payout panel: totals, In this payout · 3 sales, Not in this payout | [open](shots/round1/payouts-panel-1440-light.png) | [open](shots/round1/payouts-panel-1440-dark.png) | [open](shots/round1/payouts-panel-375-light.png) |
| Payout panel for a payout paid under the old rule | [open](shots/round1/payouts-panel-old-rule-1440-light.png) | [open](shots/round1/payouts-panel-old-rule-1440-dark.png) | [open](shots/round1/payouts-panel-old-rule-375-light.png) |
| Held sales view | [open](shots/round1/payouts-held-1440-light.png) | [open](shots/round1/payouts-held-1440-dark.png) | [open](shots/round1/payouts-held-375-light.png) |
| Paid under the old rule: notice, comparison, export | [open](shots/round1/payouts-old-rule-1440-light.png) | [open](shots/round1/payouts-old-rule-1440-dark.png) | [open](shots/round1/payouts-old-rule-375-light.png) |
| Paid under the old rule: empty | [open](shots/round1/payouts-old-rule-empty-1440-light.png) | [open](shots/round1/payouts-old-rule-empty-1440-dark.png) | [open](shots/round1/payouts-old-rule-empty-375-light.png) |

### List: Hammer and Net columns, the five views

![List: Hammer and Net columns, the five views, 1440 light](shots/round1/payouts-list-1440-light.png)

### Payout panel: totals, In this payout · 3 sales, Not in this payout

![Payout panel: totals, In this payout · 3 sales, Not in this payout, 1440 light](shots/round1/payouts-panel-1440-light.png)

### Payout panel for a payout paid under the old rule

![Payout panel for a payout paid under the old rule, 1440 light](shots/round1/payouts-panel-old-rule-1440-light.png)

### Held sales view

![Held sales view, 1440 light](shots/round1/payouts-held-1440-light.png)

### Paid under the old rule: notice, comparison, export

![Paid under the old rule: notice, comparison, export, 1440 light](shots/round1/payouts-old-rule-1440-light.png)

### Paid under the old rule: empty

![Paid under the old rule: empty, 1440 light](shots/round1/payouts-old-rule-empty-1440-light.png)

## Record signed agreement

| State | 1440 light | 1440 dark | 375 light |
|---|---|---|---|
| Dialog, default | [open](shots/round1/record-default-1440-light.png) | [open](shots/round1/record-default-1440-dark.png) | [open](shots/round1/record-default-375-light.png) |
| Dialog with errors (summary and inline) | [open](shots/round1/record-errors-1440-light.png) | [open](shots/round1/record-errors-1440-dark.png) | [open](shots/round1/record-errors-375-light.png) |
| Recording… | [open](shots/round1/record-recording-1440-light.png) | [open](shots/round1/record-recording-1440-dark.png) | [open](shots/round1/record-recording-375-light.png) |
| Recorded: toast and the lot priced | [open](shots/round1/record-recorded-1440-light.png) | [open](shots/round1/record-recorded-1440-dark.png) | [open](shots/round1/record-recorded-375-light.png) |

### Dialog, default

![Dialog, default, 1440 light](shots/round1/record-default-1440-light.png)

### Dialog with errors (summary and inline)

![Dialog with errors (summary and inline), 1440 light](shots/round1/record-errors-1440-light.png)

### Recording…

![Recording…, 1440 light](shots/round1/record-recording-1440-light.png)

### Recorded: toast and the lot priced

![Recorded: toast and the lot priced, 1440 light](shots/round1/record-recorded-1440-light.png)

## Elsewhere

| State | 1440 light | 1440 dark | 375 light |
|---|---|---|---|
| Inbox task | [open](shots/round1/inbox-task-1440-light.png) | [open](shots/round1/inbox-task-1440-dark.png) | [open](shots/round1/inbox-task-375-light.png) |
| Finance notice on Finance overview | [open](shots/round1/finance-notice-1440-light.png) | [open](shots/round1/finance-notice-1440-dark.png) | [open](shots/round1/finance-notice-375-light.png) |
| Finance notice with the rule open | [open](shots/round1/finance-notice-rule-1440-light.png) | [open](shots/round1/finance-notice-rule-1440-dark.png) | [open](shots/round1/finance-notice-rule-375-light.png) |
| Legal entity overview: Commission row | [open](shots/round1/legal-entity-1440-light.png) | [open](shots/round1/legal-entity-1440-dark.png) | [open](shots/round1/legal-entity-375-light.png) |

### Inbox task

![Inbox task, 1440 light](shots/round1/inbox-task-1440-light.png)

### Finance notice on Finance overview

![Finance notice on Finance overview, 1440 light](shots/round1/finance-notice-1440-light.png)

### Finance notice with the rule open

![Finance notice with the rule open, 1440 light](shots/round1/finance-notice-rule-1440-light.png)

### Legal entity overview: Commission row

![Legal entity overview: Commission row, 1440 light](shots/round1/legal-entity-1440-light.png)
