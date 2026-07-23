# UTM attribution (lean snapshot)

Production-only feature gated by env flags (ship dark, enable when ready).

## Flags

| Variable | App | Purpose |
|----------|-----|---------|
| `MARKETING_ATTRIBUTION_ENABLED=true` | API | Enables `PUT/DELETE /marketing/attribution`, DB persistence, and CAPI/sGTM enrichment |
| `NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED=true` | Web | Enables client capture, `_lax_attr` cookie, and sync |

Requires full marketing events config (`SGTM_ENDPOINT_URL`, `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`) — same gate as existing CAPI pipeline.

## Behaviour

1. **Landing** — On first document load, allowlisted query params (`utm_*`, `gclid`, `fbclid`, `msclkid`) are read from the URL pathname landing only.
2. **Consent** — Before marketing consent, values stay in memory only. After marketing consent, a first-party `_lax_attr` cookie stores first-touch (write-once) and last-touch snapshots (90 days, `SameSite=Lax`, `Secure` on HTTPS).
3. **Logged-in sync** — Authenticated, marketing-consented `PUT /marketing/attribution` atomically merges into `marketing_attribution` (Postgres + Redis cache).
4. **Conversions** — Consent-based website events (`Lead`, `InitiateCheckout`, wishlist) attach an immutable attribution snapshot to the marketing outbox payload. Publishers emit namespaced `attribution_first_*` / `attribution_last_*` params (not GA4 reserved `utm_*` on Measurement Protocol).
5. **Legitimate interest** — `Purchase` / KYC webhook events do **not** attach stored attribution until DPIA approves reuse.

## Operations

- `marketing_attribution_operations_total{operation,outcome,flag_state}` records value-free API sync, deletion, and enrichment outcomes.
- Postgres and Redis retain snapshots for 90 days from the latest successful sync. Redis is write-through only; DB fallback reads do not extend its TTL.
- Consent withdrawal clears browser storage and retries authenticated server deletion. The DELETE endpoint remains available without marketing consent.

## GTM

Map dataLayer fields `attribution_last_*` on `page_view` in the web container if you want them in GA4 reports. Server-side params arrive as `ep.attribution_last_*` via sGTM.

Google **Consent Mode** `url_passthrough` / `ads_data_redaction` (see [tracking-overview.md](./tracking-overview.md)) is separate from this feature: it does not set `_lax_attr` or server snapshots and does not persist campaign data on the device when marketing consent is denied.

## Campaign taxonomy

Use consistent, lower-case or fixed-case values for `utm_source`, `utm_medium`, and `utm_campaign` on every link. Prefer `utm_id` when campaign IDs are stable.

## Rollback

Disable `MARKETING_ATTRIBUTION_ENABLED` first; this is the authoritative server-side kill switch for sync and enrichment. `NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED` is compiled into the Next.js bundle and requires a web rebuild to stop browser capture. Deletion remains available while either flag is off. Do not roll back migration `0135_marketing_attribution` in production.

## Future: append-only touchpoint stream

See [utm-attribution-scalable-appendix.md](./utm-attribution-scalable-appendix.md) for the deferred multi-touch / identity-stitching design and upgrade path from this lean snapshot.
