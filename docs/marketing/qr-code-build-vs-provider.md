# Sale and Lot QR Codes: Build vs Provider

## Decision

Use a first-party dynamic QR system for sale and lot marketing links. Revisit a provider only if the team needs a managed dashboard, vendor SLA, or out-of-the-box geo/device analytics beyond the first-party reporting described here.

## Why Build

- **Domain control:** QR codes resolve through the auction domain/API, so printed gallery material is not tied to a third-party short-link domain.
- **Destination safety:** Sale and lot destinations are derived from server-side IDs and canonical URL helpers, avoiding user-supplied redirects.
- **Data ownership:** Scan analytics stay first-party, with truncated IP and minimized user-agent/referrer fields before storage.
- **Operational fit:** The existing stack already includes Postgres, Redis, Hono API routes, admin capability gates, and `qrcode.react` in the web app.
- **Backfill:** Existing production sales/lots can be populated idempotently without importing external provider IDs.

## Provider Trade-Off

An external provider can reduce implementation time and may offer polished analytics, team workflows, and SLA-backed redirect infrastructure. The trade-off is third-party data processing, vendor lock-in for printed URLs, added DNS/domain setup, and less control over redirect validation and retention policy.

## Implementation Guardrails

- Encode short dynamic URLs, not final sale/lot URLs.
- Use one-hop `302` redirects with `X-Robots-Tag: noindex`.
- Keep analytics asynchronous and privacy-minimized.
- Export SVG for print and high-resolution PNG for staff assets.
