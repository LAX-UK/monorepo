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

Apply **`0182` through `0194`** together before enabling Phase 1 flags. Migration **`0191`** installs a sync trigger that keeps legacy `shop_edition.status` aligned with `listing_status` / `custody_status` during rolling deploys; **dropping the legacy column is a separate contract release** (see below). **`0193`** data changes are irreversible (rollback is index-only), backfills LAX `owner_party_id`, reconciles sale-authority grants to authorised edition counts, and fails closed on duplicate or missing LAX parties. **`0194`** adds price CHECK constraints and LAX-seller payout cancellation (no owner backfill).

### Pre-deploy: old-schema preflight (Shop DB)

Run on the target Shop database **before** applying the Phase 1 migration chain on environments that may predate two-axis editions:

```sql
-- Required new columns must not already be half-applied without the migration journal entry.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shop_edition'
  AND column_name IN ('listing_status', 'custody_status', 'status')
ORDER BY column_name;

-- Expect legacy `status` plus new axes after 0182; after 0191 trigger, legacy `status` may still exist until column drop.
SELECT EXISTS (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'shop_edition_sync_legacy_status'
) AS legacy_sync_trigger_present;
```

If `listing_status` / `custody_status` are missing while `status` remains the only lifecycle column, stop and apply **`0182`** (and the rest of the chain) from a known migration baseline — do not enable Phase 1 flags on a pre–two-axis schema.

### Legacy `shop_edition.status` column drop (contract release)

Do **not** drop `shop_edition.status` in the same release as the first two-axis cutover. Sequence:

1. Deploy monorepo + migrations through **`0191`** (sync trigger) with all Shop runtimes reading/writing **`listing_status` / `custody_status`** only.
2. Confirm no remaining readers/writers depend on legacy `status` (grep deployables and reporting).
3. Ship a follow-up migration that drops `status` and the sync trigger once production has been stable on two-axis only.

Until step 3 ships, rollback of **`0191`** is trigger-only; data on the new axes remains authoritative.

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

Then on shop-api (local dev uses `tsx`; production image uses built CLI under `dist/scripts/`):

- Dev: `pnpm --filter @auction/shop-api sale-authority grant --operator ops:<you> --request-id …`
- Prod container: `node dist/scripts/sale-authority.js grant --operator ops:<you> …`

### Phase 1 ops (no admin UI)

- Staff: `pnpm --filter @auction/shop-api staff:grant --subject <id> --role catalogue_editor` (prod: `node dist/scripts/staff-grant.js …`)
- Sale authority: `pnpm --filter @auction/shop-api sale-authority list-pending` / `grant …` (prod: `node dist/scripts/sale-authority.js …`)
- Catalogue seed (non-prod or `--force`): `pnpm --filter @auction/shop-api seed:catalogue` (prod: `node dist/scripts/seed-catalogue.js …`)

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

## Phase 1 enable blockers (test / staging)

Do not enable Phase 1 portal or run portal acceptance until all of the following hold:

| Blocker | Check |
| --- | --- |
| Migrations | **`0182`–`0194`** applied on the Shop database (preflight SQL above on legacy DBs) |
| Identity | **`auth`** healthy and OIDC clients configured (`lax-shop-web`) **before** rolling **`shop-api`** / **`shop-identity`** / **`shop`** |
| Portal flag parity | `SHOP_PORTAL_OWNERSHIP_ENABLED=true` on **`shop-api`** and on the **`shop`** storefront (account hub links and `/account/editions` BFF routes) |
| Acceptance creds | `IDENTITY_ACCEPTANCE_EMAIL` / `IDENTITY_ACCEPTANCE_PASSWORD` (or local `SHOP_OIDC_TEST_*`) for `e2e/shop-v1-phase1.spec.ts` |
| Sale authority | Rows that must stay listed have matching `shop_sale_authority_grant` after **`0193`** (see pre-deploy SQL) |
| Ops alerts | `SHOP_OPS_ALERT_EMAIL` on **`shop-api`** when enquiry / dead-letter alerts are required |

Deploy order on test: merge infra Terraform shop flags → migrate on deploy → **`auth`** ready → **`shop-api`** → **`shop-identity`** → **`shop`** storefront → run **Shop staging acceptance** with matching `shop_sha`, **`shop_api_sha`**, and identity release SHAs from `/health/ready`.

**Identity closure:** when `compare-lax-identity` fails, sync the seven drifted paths listed by `node scripts/ci/verify-identity-closure-sync.mjs` into [lax-identity](https://github.com/LAX-UK/lax-identity) via `./scripts/identity/repo-split.sh <empty-destination>` and merge that PR before pinning staging recovery.

## Phase 2+ gate blockers (recorded; not Phase 1 scope)

Keep **`SHOP_PAYOUTS_ENABLED`**, **`SHOP_THIRD_PARTY_ENABLED`**, **`SHOP_ORIGINALS_ENABLED`**, **`SHOP_MERCHANDISE_ENABLED`**, and **`SHOP_ADMIN_ENABLED`** off until these are resolved:

- Payout eligibility accepts missing/pending compliance and has a read/update race.
- Refund amount, cumulative balance, paid status, line ownership, and idempotency payload are not validated end-to-end.
- Brokers can release another broker’s hold (hold release IDOR).
- No registered OIDC client can obtain `shop.admin`; admin UI remains deferred.
- **`SHOP_MERCHANDISE_ENABLED`** is build-time baked on the storefront static merchandise page — runtime enable is unsafe without a follow-up release.
- Payouts/documents portal routes have inconsistent no-party behaviour when payouts are enabled.
- Admin audit gaps, finance step-up, URL-prefix auth, identity merge, refunded status, and fulfilment-price issues listed in prior gate reviews.
- Hold `createHold` role-aware broker resolution; possession date bounds (`paidAt` ≤ `possessionAt` ≤ now) and finance recency on possession.
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

- Staging: [shop-staging-acceptance.yml](../../.github/workflows/shop-staging-acceptance.yml). Tier 1 on every deploy (`seed_catalogue=false`): health pin, auth contracts, portal smoke. Full Phase 1 matrix with `seed_catalogue=true`: catalogue seeds, portal/commerce fixtures, guest basket, filters, POA interest, desktop + mobile a11y, Stripe test checkout on `acceptance-stripe-print`, and strict Playwright skip audit. Phase 2–4 flags remain disabled and are out of scope for Phase 1 sign-off.
- PR Postgres smoke: [ci.yml](../../.github/workflows/ci.yml) job **`shop-v1-phase-smoke`** (shop-domain + migration contract tests, shop-api Postgres integration, shop build) when Shop-related paths change.
- PR browser gates: [e2e-pr.yml](../../.github/workflows/e2e-pr.yml) (Shop buyer flow + phase 1 portal smoke with portal flag on shop-api and storefront).

## Test environment deploy sequence (Phase 1)

1. Merge [auction-infra](https://github.com/LAX-UK/auction-infra) shop flag Terraform (maps `SHOP_*_ENABLED` and `SHOP_OPS_ALERT_EMAIL` on test `shop-api`).
2. On the monorepo **test** environment, confirm repo variables: `AUTO_DEPLOY_SHOP_TEST=true`, `USE_PREBUILT_IMAGES_TEST=true`, `APP_DEPLOY_SOURCE_TEST=image`, `SHOP_PORTAL_OWNERSHIP_ENABLED=true` (Phase 2–4 shop flags stay `false` until their gates). Confirm secrets: `OPS_ALERT_EMAIL`, `IDENTITY_ACCEPTANCE_EMAIL`, `IDENTITY_ACCEPTANCE_PASSWORD`.
3. Merge the Phase 1 monorepo PR; run **App deploy test** on that commit (immutable Shop path applies migrations **0182–0194** and rolls shop-api / shop / shop-identity). Or dispatch with `deploy_shop=true` when forcing a Shop cutover.
4. Run **Shop staging acceptance** twice consecutively with the same deployed 40-char `shop_sha` from `/health/ready` and `seed_catalogue=true` (disposable staging only). Retain workflow artifacts (Playwright HTML report + traces). Populated portal requires portal seed (`SHOP_ACCEPTANCE_PORTAL_SEEDED=true` in workflow when seeding).
5. Do not declare Phase 1 ready on test until both acceptance runs are green with zero failures and zero unexpected skips, release SHA matches `/health/ready`, and Stripe confirmation + paid order are proven in the seeded run.
