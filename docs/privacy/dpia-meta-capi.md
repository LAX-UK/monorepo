# DPIA note: Meta Conversions API (server-side)

**Scope**: LAX auction platform production (`lax.bid`).  
**Last updated**: 2026-05-16.

## Processing activities

1. **Browser (consent: marketing + analytics)** — GTM web container → first-party sGTM (`gtm.lax.bid`) → GA4 / Meta Pixel + CAPI tag. Sets/reads `_fbp`, `_fbc`, and related first-party identifiers subject to consent.
2. **Server (request-bound, consent: marketing)** — API emits events when the user performs an action in-session; `EventMarketingConsentGate` allows consent-basis events only when `event.consent.marketing` is true (from `x-lax-consent-marketing` / `x-lax-consent-analytics` headers set by the web app after cookie consent). PII is hashed (SHA-256) before leaving our infrastructure. `event_source_url` (sanitized path/query), client IP, and user-agent are forwarded when present for Event Match Quality.
3. **Server (webhook / backend, legitimate interest)** — `Purchase` on payment capture and `CompleteRegistration` on KYC approval when no browser session exists; no terminal storage is read for those emissions. Basis: GDPR Art. 6(1)(f).

## Legitimate Interest Assessment (EDPB Guidelines 1/2024)

For each processing activity relying on Art. 6(1)(f), we apply the three cumulative tests from EDPB Guidelines 1/2024.

### `Purchase` (payment captured)

| Test | Assessment |
|------|------------|
| **Purpose** | Reconcile ad spend with completed sales; detect billing fraud patterns; measure campaign ROI for the auction business. |
| **Necessity** | Server-side `Purchase` is the only reliable signal when the buyer closes the browser before the thank-you page loads or when ad blockers suppress the Pixel. Without it, reported ROAS is materially understated. |
| **Balancing** | Data minimised: hashed email/external_id, lot/payment facts only; no `_fbp`/`_fbc` read for this path; users can object via privacy contact; impact is proportionate to a commercial relationship already established by winning a lot. |

### `CompleteRegistration` (KYC approved)

| Test | Assessment |
|------|------------|
| **Purpose** | Attribute completed registrations to acquisition campaigns; optimise onboarding funnels. |
| **Necessity** | KYC approval happens asynchronously via Stripe Identity webhook — no browser session at event time, so consent-based Pixel cannot fire. |
| **Balancing** | Only fires on verified identity approval (not on every page view); hashed identifiers only; no marketing cookies read; user has already entered a contractual relationship by registering. |

**Documentation**: LIA reviewed on implementation; re-review when adding new legitimate-interest event types or new vendors.

## Data minimisation

- Outbox stores event payloads **without** plaintext PII.
- Email/name resolved at publish time in the worker and hashed per Meta spec.
- `_fbp` / `_fbc` persisted in Postgres + Redis (90-day TTL) keyed by `userId` for async conversion matching.
- Website events include `event_source_url` (Referer / `x-lax-page-url`) and client IP/UA only when the request originates from the browser.

## Retention

- Outbox rows: terminal states (`sent` / `skipped` / `failed`) purged after 30 days; payloads may contain IP/UA/URLs until purge.
- Postgres click IDs: purged after 90 days (daily worker job); Redis cache 90-day TTL.
- Meta: per Meta Business Tools terms.

## International transfers

Meta (US) and Google (GTM cloud image / tooling) may process data outside the UK/EEA. We rely on Meta and Google DPAs/SCCs where applicable and limit payloads to hashed identifiers and event facts. A full transfer impact assessment is maintained with legal counsel when vendors or regions change.

## Sub-processors

| Party | Role |
|-------|------|
| Meta Platforms | Ads measurement (CAPI); independent controller for matched audiences |
| Google (Tag Manager / cloud image) | Server-side tagging runtime hosted on our infrastructure |
| DigitalOcean | App hosting for sGTM containers |

## User rights

- Consent withdrawal via cookie banner / footer preferences stops new consent-based events.
- Existing server legitimate-interest events are documented and limited to payment/KYC facts above.
- Data subject requests: contact privacy@lax.bid; Meta acts as independent controller for matched ads.

## Review triggers

- New vendors in sGTM (TikTok, LinkedIn, etc.)
- Cross-border transfer changes
- CNIL / ICO guidance updates on server-side tagging
- New legitimate-interest event types (requires updated LIA)
