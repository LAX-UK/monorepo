# Marketing attribution rollout (release line)

Ship code first, migrate before relying on sync, validate GTM consent, then treat the API flag as the kill switch.

## 1. Release scope

- Deploy only the commits on `feat/marketing-attribution-snapshot-release`.
- Do not merge `main` into `release`; the branch lines have intentionally diverged.
- Pushes to `release` trigger production deployment when application, package, or web-build files change.

## 2. Database (expand-first)

Run migration `0128_marketing_attribution` before or in the same deploy window as the API/web rollout. Use the standard migrate component with `DATABASE_URL_OWNER`. Do not roll this migration back in production.

## 3. Feature flags (dark → live)

| Variable | Layer | Recommended sequence |
|----------|-------|----------------------|
| `MARKETING_ATTRIBUTION_ENABLED` | API | Leave `false` until migration and smoke tests pass, then enable and redeploy API. |
| `NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED` | Web build | Enable for the web image; changing it requires a rebuild. |

The API flag is the authoritative kill switch for sync, database writes, and event enrichment. Browser capture stops only after rebuilding web with the public flag disabled.

Existing marketing event configuration is also required: `SGTM_ENDPOINT_URL`, `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`, and `META_CAPI_ACCESS_TOKEN`.

## 4. GTM / sGTM

1. Confirm every web tag respects Consent Mode.
2. Map `attribution_first_*` / `attribution_last_*` dataLayer fields on key browser events.
3. Confirm the sGTM GA4 Client receives `ep.attribution_first_*`, `ep.attribution_last_*`, `cid`, and `sid`.
4. Use consistent `utm_source`, `utm_medium`, and `utm_campaign`; prefer stable `utm_id`.

## 5. Smoke test (marketing consent granted)

1. Open a test campaign URL and grant consent. Confirm `_lax_attr` is readable after one decode and has `Max-Age=7776000`.
2. Log in and confirm `PUT /marketing/attribution` succeeds.
3. Fire a consent-based conversion and confirm namespaced attribution plus matching GA4 client/session identifiers reach sGTM.
4. Complete a new Google or Apple signup. Confirm one browser `sign_up` and one idempotent server `Lead`.
5. Repeat with an existing OAuth account. Confirm `login` and no new server `Lead`.
6. Withdraw marketing consent. Confirm browser cookie removal and authenticated server deletion.

Without marketing consent, `_lax_attr`, attribution sync, OAuth conversion events, and GA4 identifier forwarding must remain disabled.

## 6. GA4 / GTM console checklist

### Unwanted referrals

In **Admin → Data Streams → Configure tag settings → List unwanted referrals**, add:

- `accounts.google.com`
- `appleid.apple.com`
- `auth.lax.bid`
- `checkout.stripe.com`
- `veriff.com`

### Custom dimensions

Register event-scoped custom dimensions for the required `attribution_first_*` and `attribution_last_*` parameters. They are not retroactive and may take 24–48 hours to appear.

### Web container mapping

In web container `GTM-W6K4N67Z`, map attribution fields on `page_view`, `login`, `sign_up`, and other required events.

### Data retention

In **Admin → Data Settings → Data Retention**:

- Set event data retention to 14 months.
- Enable **Reset user data on new activity**.

### Internal traffic

Confirm office and VPN test addresses are not hidden by the internal-traffic filter during validation.

### Server container URL

Verify the web Google tag's `server_container_url` is `https://gtm.lax.bid`.

Use DebugView for OAuth journeys; Realtime acquisition cards can lag or omit the initial source.

## 7. Rollback

1. Set `MARKETING_ATTRIBUTION_ENABLED=false` and redeploy API.
2. Rebuild web with `NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED=false` if browser capture must stop.
3. Do not drop `marketing_attribution` in production.
