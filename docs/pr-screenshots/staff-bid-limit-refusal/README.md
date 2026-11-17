# Staff-placed bid refused at a limit

The clerk console's "Lot on block" panel after a paddle or telephone bid was refused at a limit,
at 1440 px and 375 px, light and dark. File names read `{theme}-{width}-{case}.png`.

| Case | Shows |
| --- | --- |
| `paddle` | Paddle 142 bids £6,000.00 over its £5,000.00 limit for the sale |
| `account-limit` | A bid of £9,000.00 on an unnamed phone line stopped at the organisation's own limit. Only the £5,200.00 left on this lot is shown, never the organisation's total |
| `buyer-agent-total` | A bid of £6,000.00 on an unnamed phone line stopped at a buyer agent's total authorisation. Only the £1,500.00 left on this lot is shown, never the total or what is committed on other lots |
| `registration` | A bid of £9,000.00 on an unnamed phone line over the buyer's £5,000.00 approved limit for the sale |

Taken from the real panel, hook and command transport on a local dev server. The panel was mounted
on a temporary page (not committed) inside the staff density, and the browser's call to the Bid BFF
was answered with the body the API returns for that refusal (`{ error, code, refusal }`). The notice sits above the form it concerns (FBK-1). Sample
data only. The live console itself shows a read-only view below 1024 px; the 375 px shots show
the panel's notice wrapping at phone width.
