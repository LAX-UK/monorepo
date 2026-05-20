# Server-side GTM + Meta Conversions API (operations)

Production-only. Local/staging builds omit `NEXT_PUBLIC_GTM_ID` and API marketing env vars so nothing runs.

## Infrastructure

- **Tagging cluster**: `https://gtm.lax.bid` (App Platform service `gtm-tagging`, 2× `professional-s`)
- **Preview server**: `https://gtm-preview.lax.bid` (1× `professional-xs`, `RUN_AS_PREVIEW_SERVER=true`)
- **Secrets** (GitHub → Terraform): `GTM_SST_CONTAINER_CONFIG`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE`

Validate after deploy:

```bash
curl -sS -o /dev/null -w "%{http_code}" https://gtm.lax.bid/healthy
curl -sS -o /dev/null -w "%{http_code}" https://gtm-preview.lax.bid/healthy
```

## Web container (`GTM-W6K4N67Z`)

1. **GA4 Configuration** tag:
   - `transport_url` = `https://gtm.lax.bid`
   - `first_party_collection` = `true`
   - Fields: `x-fb-ck-fbp` ← 1st-party cookie `_fbp`; `x-fb-ck-fbc` ← `_fbc`
2. Ensure GA4 Event tags fire on conversions with `event_id` from the dataLayer.

## Server container (`GTM-P79V48Q7`)

1. Admin → Container settings → Server container URL: `https://gtm.lax.bid`
2. Add **GA4 Client** (listens for web hits).
3. Add **Meta Conversions API** tag (Meta template) with Pixel ID + access token; trigger on all GA4 client events.
4. Publish; use Preview against `gtm-preview.lax.bid`.

## Meta Events Manager

1. Use **Test events** with `META_CAPI_TEST_EVENT_CODE` until Event Match Quality is acceptable.
2. Confirm deduplication via matching `event_id` between browser dataLayer and server events.
3. Remove test code from Terraform when live.

## Application events (reference)

| Event | Source |
|-------|--------|
| `page_view`, `view_item`, `search` | Web dataLayer (`apps/web/src/lib/analytics/events.ts`) |
| `bid_placed` | Web dataLayer only (`apps/web/src/lib/analytics/events.ts`) |
| `InitiateCheckout` | API on `POST /payments` |
| `Purchase` | API on payment capture (legitimate interest) |
| `CompleteRegistration` | Stripe Identity webhook when KYC approved |
| `Lead` | `POST /users/register` |
| `AddToWishlist` / `RemoveFromWishlist` | Watchlist API |
| `_fbp` / `_fbc` sync | Authenticated `POST /marketing/click-ids` (marketing consent) |

## TLS and DNS

`gtm.lax.bid` is a DNS-only Cloudflare `CNAME` to `eum.stape.io` (Stape terminates TLS). `gtm-preview.lax.bid` still points at the App Platform hostname until preview is migrated or removed.

## Disable / rollback

- Clear `SGTM_ENDPOINT_URL` (and related Meta env) in App Platform → marketing pipeline no-ops (`isMarketingEventsEnabled` false).
- Admin replay: `POST /platform/marketing-events/replay` with `dryRun: true` and bounded `limit` (default 500) before requeueing.
