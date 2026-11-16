# Live sale fixes: screenshots

Playwright screenshots of the real components from this change, rendered by the running app
(`next dev`) with mocked props and no API behind them. Each is taken at 375 and 1440 px wide, light
and dark, with reduced motion and no horizontal scroll. Files are named `{scene}-{width}-{theme}.png`.
The cookie banner was dismissed and the dev indicator and floating widget hidden, so nothing sits
over the content.

| Scene | What it shows |
|---|---|
| `hero-live` | Sale hero badge reads `Live now` while the saleroom is live (the sale is still marked scheduled). |
| `hero-paused` | The same badge while the saleroom is paused: still `Live now`, a deliberate choice. |
| `signed-out` | Sale page header for a signed-out visitor with live status loaded: no "Could not refresh saleroom status" banner. |
| `lot-outbid` | The outbid chip (`Outbid on Harbour at Dawn`) while the lot is open. |
| `lot-closed` | The same chip after the lot's `lotEnded` signal: cleared at once. |
| `leader-channel` | Clerk console session bar, bidder with no paddle match: `Online bidder`, never a raw id. |
| `leader-paddle` | Clerk console session bar with a roster match: `Paddle 27 · A. Example`. |

Limits: these are component-level renders on mocked data, not a full sale against a live API. The
`signed-out` scene shows the page state, not the network exchange; the anonymous request paths are
covered by the BFF route tests. The public display board is not shown; it uses the same leader label.
