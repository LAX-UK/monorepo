# Load testing (outline)

Updated: April 27, 2026

Use [k6](https://k6.io/) or [Artillery](https://www.artillery.io/) against a staging API.

## Scenarios

1. **Concurrent bidding** — Many VUs POST `/bids` with unique `Idempotency-Key` headers on the same active English `lotId`.
2. **Anti-sniping** — Burst bids near the end of an English or buy-it-now lot and verify `lotExtended` events via WebSocket.
3. **Dutch acceptance** — Bid exactly `currentPrice` on an active Dutch lot and verify the lot ends, lifecycle jobs are cancelled, and `lotEnded` is emitted.
4. **Read path** — GET `/lots`, `/lots/:id`, `/lots/:id/bids`, `/sales`, `/sales/:id`, and `/sales/:id/lots` under load.
5. **Payments** — For ended lots with winners, POST `/payments` and verify either a pending local payment or optional Xero `checkoutUrl`.

## Example k6 script (sketch)

```javascript
import http from "k6/http";
import { check } from "k6";

export const options = { vus: 50, duration: "2m" };

export default function () {
  const res = http.get(`${__ENV.API_URL}/health`);
  check(res, { "200": (r) => r.status === 200 });
}
```

Run with `k6 run script.js -e API_URL=https://staging.example.com`.

Ensure rate limits, Redis, BullMQ lifecycle workers, and Postgres connection limits are sized for your target RPS.
