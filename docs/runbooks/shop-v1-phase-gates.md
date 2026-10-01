# Shop V1 phase gates

Phased delivery uses feature flags on `shop-api` (and related deployables). Do not enable a phase in production until its gate checklist passes.

## Flags

| Flag | Phase | Effect |
| --- | --- | --- |
| `SHOP_PORTAL_OWNERSHIP_ENABLED` | 1 | `/v1/me/editions`, sale authority |
| `SHOP_ADMIN_ENABLED` | 1 | `/admin/v1/*` staff routes (UI deferred; use ops CLI) |
| `SHOP_PAYOUTS_ENABLED` | 2 | Production, fulfilment, refunds admin routes; payout-eligibility scheduler; portal payouts/documents |
| `SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS` | 1+ | Max age of OIDC `auth_time` for refund, fee approve, and mark-paid (default 900) |
| `SHOP_THIRD_PARTY_ENABLED` | 3 | Holds, third-party sales, fees; broker assignment enforcement |
| `SHOP_ORIGINALS_ENABLED` | 4 | Original sale admin workflow |
| `SHOP_MERCHANDISE_ENABLED` | 4 | Merchandise admin + storefront stub |
| `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED` (worker) | 1 | `shop.artwork.created` → Zoho Products |
| `ZOHO_CRM_DEAL_STAGE_SHOP_ENQUIRY` (worker) | 4 | Enquiry deals stage (do not reuse shop-paid stage) |

## Phase 1 deploy (migrations)

Apply **`0182` through `0194`** together before enabling Phase 1 flags. Migration **`0191`** drops legacy `shop_edition.status` (required for two-axis listing/custody). **`0193`** data changes are irreversible (rollback is index-only). **`0194`** adds price CHECK constraints and backfills LAX `owner_party_id`.

### Pre-deploy: artist editions de-authorised by 0193

Run before production deploy; grant authority for rows that should remain listed:

```sql
SELECT e.artwork_id, e.owner_party_id, COUNT(*) AS authorised_editions
FROM shop_edition e
WHERE e.listing_status = 'authorised'
  AND e.owner_party_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM shop_sale_authority_grant g
    WHERE g.artwork_id = e.artwork_id AND g.owner_party_id = e.owner_party_id
  )
GROUP BY e.artwork_id, e.owner_party_id;
```

Then on shop-api: `pnpm sale-authority grant --operator ops:<you> --request-id …` or `--artwork` + `--owner-party` + `--count`.

### Phase 1 ops (no admin UI)

- Staff: `pnpm staff:grant --subject <id> --role catalogue_editor`
- Sale authority: `pnpm sale-authority list-pending` / `grant …`
- Catalogue seed (non-prod or `--force`): `pnpm seed:catalogue`

## Phase 1 Zoho catalogue

- Worker: set `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED=true` when sandbox/production CRM has `Products` fields (`Product_Code`, `LAX_Shop_Artwork_Id`, `LAX_Eligible_For_Editions`).
- `shop.artwork.created` deliveries upsert Products; failures retry via CRM delivery ledger.

## Phase 2 gate (sell, deliver, get paid)

- Migrations `0186`–`0188` and **`0193`** applied (0193 backfills paid-order fulfilment, LAX grants, hold uniqueness, cancels LAX-seller payout rows).
- Contract tests `migration-0186-contract.test.ts`, `migration-0193-contract.test.ts`, `migration-0194-contract.test.ts` green.
- Legal/config: cancellation period policy loaded (not hard-coded); until then APIs return `shop.policy_not_configured`.
- Stripe restricted key extended per [shop-stripe-setup.md](./shop-stripe-setup.md) (Phase 2 scopes).
- Acceptance test **#4** scripted (direct sale → production → fulfilment → cancellation → manual payout) — E2E not fully automated yet.

## Phase 3 gate (operations)

- Migration `0189` applied; broker assignments populated for production brokers.
- Reconciliation job skeleton: `apps/worker/src/jobs/shop-stock-reconciliation.job.ts` (not scheduled until ops wire cron).
- Acceptance tests **#3** (hold) and **#5** (third-party gross/fees/net).

## Phase 4 gate (originals + merchandise)

- Migrations `0190`–`0191` applied with the rest of the Phase 1 chain (`0182`–`0194`).
- Enquiry → Zoho Deal mapping enabled for `shop.artwork.interest_registered` with `intent=enquiry` and `ZOHO_CRM_DEAL_STAGE_SHOP_ENQUIRY` configured.
- Acceptance tests **#6** (original sale) and merchandise smoke.

## Phase 2+ gate blockers (recorded; not Phase 1 scope)

- Hold `createHold` role-aware broker resolution; broker release IDOR.
- Possession date bounds (`paidAt` ≤ `possessionAt` ≤ now) and finance recency on possession.
- Refund amount caps and idempotency payload matching; Stripe refund wiring.
- Missing audit on production/third-party/original writers and hold-expiry scheduler.
- VAT computation on checkout lines.
- Dispatch/production/refund/cancellation customer emails (templates exist; not all wired).
- Zoho order financials stub (`crm-shop-record-sync-handler` Phase 2 path).
- Stock reconciliation job registration.
- DB uniqueness: merchandise basket lines, open original sales, third-party sale per edition.
- Payout ledger nullable `order_line_id` for non-order sources.
- Merchandise admin capability check when real data exists.
- `lax-shop-admin` OIDC client + `apps/shop-admin` BFF UI (deferred).

## CI

- Staging: [shop-staging-acceptance.yml](../../.github/workflows/shop-staging-acceptance.yml) (foundation browser tiers; runs `seed:catalogue` with explicit sale-authority grants). Set `SHOP_PORTAL_OWNERSHIP_ENABLED=true` for portal pages.
- Phase-scoped: [shop-v1-acceptance.yml](../../.github/workflows/shop-v1-acceptance.yml) (Postgres integration, shop-domain + migration contract tests, shop build).
