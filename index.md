# Panel header links: before and after

Rule R5 from the row-click design: a queue panel's header slot holds only "Open full page", and only when it goes to the same record's page. Links to a different record live in the panel's `…` menu and/or on the related value in the body, with their permission checks kept.

Shots are 1440 and 375 wide, light mode, of the real panel components rendered with fixture data (`bid-payout-<width>-before|after.png` under `shots/`). The panel `…` menu is not open in the shots; the moved link is the first item in it (for payments it is shown only when the person may open lots).

## Changed by this PR

| Panel | Before (header) | After | Result |
|---|---|---|---|
| Bid admin payouts | Open seller | Open seller in the `…` menu | fixed |
| Bid admin onboarding issues | Open full page, which went to another record | link in the `…` menu with its own label | fixed |

Payouts is the only panel with before/after shots: the panel's `…` menu is not open in them, and the moved link is the first item in it. Main moved on while this was open ("Bid admin: work queues step through their panels", #1369 changed the other Bid admin panels), so only payouts and onboarding still broke the rule; the earlier shots of the other panels were dropped.

## Every panel checked (against current main)

| App | Panel | Header slot | Result |
|---|---|---|---|
| Bid admin | Payouts | was Open seller | fixed |
| Bid admin | Onboarding issues | was Open full page to another record | fixed |
| Bid admin | AML screenings | none, Open client in `…` | OK |
| Bid admin | Condition reports | none, Open lot in `…` | OK |
| Bid admin | Lot fulfilment | none, Open lot in `…` | OK |
| Bid admin | Payments | none, Open lot and Open buyer in `…` | OK |
| Bid admin | Held payments | none, Open lot and Open winner in `…` | OK |
| Bid admin | Work inbox | Open full page (the record the item is about) | OK |
| Bid admin | Audit event | none | OK |
| Bid admin | Invitations | none | OK |
| Bid admin | Email sends | none | OK |
| Bid admin | Accounting details | none | OK |
| Bid admin | Desk hand-over | none | OK |
| Bid admin | KYC history | none | OK |
| Bid admin | Customise (dashboard) | none | OK |
| LAX Admin | Fulfilment queue | Open full page, same order | OK |
| LAX Admin | Production queue | Open full page, same task | OK |
| LAX Admin | Audit log event | none | OK |
| LAX Admin | Holds | none | OK |
| LAX Admin | Original sales | none | OK |
| LAX Admin | Third-party sales | none | OK |
| LAX Admin | Sale limit requests | none | OK |
| LAX Admin | Payouts | none | OK |
| Client workspace | no DetailPanel or queue panels | n/a | OK |
