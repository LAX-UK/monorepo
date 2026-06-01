# Sale and Lot QR Codes: Build vs Provider

## Decision

Use a first-party dynamic QR system for sale and lot marketing links. Revisit a provider only if the team needs a managed dashboard, vendor SLA, or out-of-the-box geo/device analytics beyond the first-party reporting described here.

## Why Build

- **Domain control:** QR short links are served on the main site origin (`WEB_ORIGIN`, e.g. `https://lax.bid/q/{code}`), so printed gallery material uses the brand domain rather than a third-party short-link domain or the API subdomain.
- **Destination safety:** Sale and lot destinations are derived from server-side IDs and canonical URL helpers, avoiding user-supplied redirects.
- **Data ownership:** Scan analytics stay first-party, with truncated IP and minimized user-agent/referrer fields before storage.
- **Operational fit:** The existing stack already includes Postgres, Redis, Hono API routes, admin capability gates, and `qrcode.react` in the web app.
- **Backfill:** Existing production sales/lots can be populated idempotently without importing external provider IDs.

## Provider Trade-Off

An external provider can reduce implementation time and may offer polished analytics, team workflows, and SLA-backed redirect infrastructure. The trade-off is third-party data processing, vendor lock-in for printed URLs, added DNS/domain setup, and less control over redirect validation and retention policy.

## Implementation Guardrails

- Encode short dynamic URLs on `WEB_ORIGIN` (`/q/{code}`), not final sale/lot URLs.
- Route `/q/*` on the web hostname to the API redirect handler (App Platform ingress, local nginx, or a Next.js dev proxy).
- Keep legacy `api.{domain}/q/*` working for already-printed labels.
- Use one-hop `302` redirects with `X-Robots-Tag: noindex`.
- Keep analytics asynchronous and privacy-minimized.
- Export SVG for print and high-resolution PNG for staff assets.
- Ship ingress routing and URL generation changes together on deploy.
