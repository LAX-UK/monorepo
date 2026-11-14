# Panel header links: before and after

Rule R5 from the row-click design: a queue panel's header slot holds only "Open full page", and only when it goes to the same record's page. Links to a different record live in the panel's `…` menu and/or on the related value in the body, with their permission checks kept.

Shots are 1440 and 375 wide, light mode, of the real panel components rendered with fixture data (`bid-<panel>-<width>-before|after.png` under `shots/`). The panel `…` menu is not open in the shots; the moved link is the first item in it (for payments it is shown only when the person may open lots).

## Changed panels

| Panel | Before (header) | After | Result |
|---|---|---|---|
| Bid admin payouts | Open seller | Open seller in `…` | fixed |
| Bid admin AML screenings | Open client | Open client in `…` (client is also linked in the body) | fixed |
| Bid admin condition reports | Open lot | Open lot in `…` | fixed |
| Bid admin lot fulfilment | Open lot | Open lot in `…` | fixed |
| Bid admin payments | Open lot (when allowed) | Open lot in `…`, same permission; Open buyer unchanged | fixed |
| Bid admin held payments (manual review) | Open lot (when allowed) | none in header; Open lot, Open winner already in `…` | fixed |
| Bid admin onboarding issues | "Open full page" to the legal entity, client or artist | none in header; the link stays in `…` and in the body with its real label | fixed |

## Every panel checked

| App | Panel | Header slot | Result |
|---|---|---|---|
| Bid admin | Payouts | was Open seller | fixed |
| Bid admin | AML screenings | was Open client | fixed |
| Bid admin | Condition reports | was Open lot | fixed |
| Bid admin | Lot fulfilment | was Open lot | fixed |
| Bid admin | Payments | was Open lot | fixed |
| Bid admin | Held payments | was Open lot | fixed |
| Bid admin | Onboarding issues | was "Open full page" to another record | fixed |
| Bid admin | Work inbox | Open full page (opens the record the item is about) | OK |
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

Judgement call: the work inbox item has no page of its own, so its "Open full page" is the page of the record it points to; left as is.
