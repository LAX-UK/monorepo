# Marketing attribution rollout (recommended order)

Ship code first, migrate before relying on sync, validate GTM consent, then treat API flag as the kill switch.

## 1. Code merge

- **main:** PR #309 (attribution snapshot + consent measurement hardening).
- **release:** PR #310 (same feature on the release line). Pushes to `release` trigger **App deploy prod** when `apps/**`, `packages/**`, or `infra/web-build/**` change.

## 2. Database (expand-first)

Run the migrate job **before** or as part of the same deploy window as API/web that enable attribution:

| Branch line | Migration tag |
|-------------|-----------------|
| main | `0135_marketing_attribution` |
| release | `0128_marketing_attribution` (equivalent schema) |

Use the standard **migrate** component / `pnpm --filter @auction/db db:migrate` against the target DB with `DATABASE_URL_OWNER` (or your prod migrate job). Do **not** roll back this migration in production.

## 3. Feature flags (dark → live)

| Variable | Layer | Recommended sequence |
|----------|--------|----------------------|
| `MARKETING_ATTRIBUTION_ENABLED` | API (Terraform / DO runtime) | Optional: leave `false` until migration + smoke test pass; then set `true` and redeploy API only. Prod Terraform apply defaults to `true` when the repo var is unset. |
| `NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED` | Web build | Baked at image build (`infra/web-build/prod.env` is `true`). Changing it requires a **web rebuild**. |

Server-side kill switch: disable **`MARKETING_ATTRIBUTION_ENABLED`** first (stops sync, DB writes, CAPI/sGTM enrichment). Browser capture stops only after a web rebuild with the public flag off.

Requires existing marketing events config (same gate as CAPI/sGTM): `SGTM_ENDPOINT_URL`, `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`.

## 4. GTM / sGTM (manual, before trusting prod data)

1. **Consent Mode** — Every tag in the **web** container must respect Consent Mode (GTM loads under advanced Consent Mode; denied marketing must not fire personalisation tags).
2. **dataLayer** — Map `attribution_last_*` on key events (e.g. `page_view`) if you want GA4 reporting from the browser.
3. **Server** — Map `ep.attribution_first_*` / `ep.attribution_last_*` (sGTM) and Meta CAPI custom data from the outbox payload.
4. **Links** — Use consistent `utm_source`, `utm_medium`, `utm_campaign`; prefer stable `utm_id`.

See [utm-attribution.md](../marketing/utm-attribution.md) and [tracking-overview.md](../marketing/tracking-overview.md).

## 5. Smoke test (marketing consent **granted**)

1. Open a campaign URL with test UTMs → after consent, `_lax_attr` is set (first + last touch).
2. Log in → `PUT /marketing/attribution` succeeds; check `marketing_attribution_operations_total{operation="put",outcome="success"}`.
3. Fire a consent-based conversion (e.g. Lead / wishlist) → sGTM/Meta receive namespaced attribution params (not cross-vendor click IDs).
4. Withdraw marketing consent → cookie cleared; authenticated `DELETE /marketing/attribution` retried.

**Without** marketing consent: no `_lax_attr` persistence or server sync; Google passthrough/redaction does not substitute for this feature.

## 6. Not in scope until DPIA

`Purchase` and KYC webhook events do **not** attach stored attribution until legitimate-interest reuse is approved.

## Rollback

1. Set `MARKETING_ATTRIBUTION_ENABLED=false` → redeploy API.
2. Rebuild web with `NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED=false` if browser capture must stop.
3. Do not drop `marketing_attribution` table in prod.
