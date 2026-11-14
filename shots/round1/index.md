# PR #1364, round 1: legal entities open their page, payouts step through a queue

From a local seeded stack (Postgres 16, db:migrate, db:roles, db:seed:dev), signed in as the seeded admin.
Desktop is 1440×900 in light and dark; phone is 375×812 in light.

## Legal entities

| | Light | Dark |
| --- | --- | --- |
| List, sorted by name (sort in the URL) | ![](desktop-light-1-legal-entities-list.png) | ![](desktop-dark-1-legal-entities-list.png) |
| Row clicked: the entity's page, "6 of 38" pager from the list | ![](desktop-light-2-legal-entity-overview.png) | ![](desktop-dark-2-legal-entity-overview.png) |
| Overview: readiness, and the business summary with Documents | ![](desktop-light-3-legal-entity-overview-business-summary.png) | ![](desktop-dark-3-legal-entity-overview-business-summary.png) |

The readiness facts the old panel showed (Connect stage, can sell, can get paid, blockers, Stripe Connect, requirements, LAX-managed, created by, documents, updated, ID) are all on the Overview.

## Payouts

| | Light | Dark |
| --- | --- | --- |
| List | ![](desktop-light-4-payouts-list.png) | ![](desktop-dark-4-payouts-list.png) |
| First row opened, J pressed twice: "3 of 4", payout in the URL | ![](desktop-light-5-payouts-panel-3-of-n.png) | ![](desktop-dark-5-payouts-panel-3-of-n.png) |

Phone, stepped twice with the arrow buttons: full screen panel, "3 of 4".

![](phone-light-5-payouts-panel-phone.png)

The seed has four payouts, so the queue shows "3 of 4". The clawback payout shown has no footer actions for this payout.
