# Zoho CRM integration

Region: **EU**.

| Host | Production | Sandbox (test worker) |
|------|------------|------------------------|
| Accounts | `https://accounts.zoho.eu` | same |
| CRM API | `https://www.zohoapis.eu` | `https://sandbox.zohoapis.eu` |
| Campaigns / legacy | `https://www.zohoapis.eu` (`ZOHO_API_HOST`) | unchanged |

Campaigns newsletter sync uses `ZOHO_API_HOST`. CRM sync uses **`ZOHO_CRM_API_HOST`** so test can target the sandbox without breaking Campaigns.

## OAuth

Register a server-side OAuth client at [Zoho API Console (EU)](https://api-console.zoho.eu).

Scopes (sandbox integration user):

- `ZohoCRM.modules.leads.ALL`
- `ZohoCRM.modules.contacts.ALL`
- `ZohoCRM.modules.deals.ALL`
- `ZohoCRM.settings.fields.READ`
- `ZohoCRM.coql.READ`
- `ZohoCRM.settings.recycle_bin.DELETE`
- `ZohoCRM.org.READ`

GitHub **test** / **production** environment secrets: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REFRESH_TOKEN` (wired into Terraform as `TF_VAR_zoho_*`) — never in chat.

Test Terraform sets `ZOHO_CRM_SYNC_MODE=off` until all three OAuth secrets are present; otherwise the mode comes from GitHub **test** environment variables (default `dry_run` in CI). Org check runs only for `canary` / `live`.

## Test rollout controls (GitHub environment `test`)

Set these **variables** (not secrets) on the monorepo test environment; Terraform test workflows pass them as `TF_VAR_zoho_crm_*`:

| Variable | Default in CI | Purpose |
|----------|---------------|---------|
| `ZOHO_CRM_SYNC_MODE` | `dry_run` | `off` \| `dry_run` \| `canary` \| `live` on test worker |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | `user.registered` | Comma-separated allowlist |
| `ZOHO_CRM_AUCTION_PIPELINE` | empty | e.g. `LAX Platform` before deal events |
| `ZOHO_CRM_DEAL_STAGE_LOT_WON` | empty | e.g. `Lot Won` |
| `ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED` | empty | e.g. `Paid` |
| `ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED` | empty | e.g. `Refunded` |
| `ZOHO_CRM_DEAL_STAGE_SHOP_PAID` | empty | e.g. `Paid` |
| `ZOHO_CRM_LEAD_CONVERSION_ENABLED` | `false` | Set `true` before lot-win conversion tests |

After changing vars, re-run **Terraform test up** (with image contracts) or **Terraform apply test** so the worker spec updates.

**Zoho CRM maintenance (test)** workflow (`zoho-crm-maintenance-test.yml`): manual `backfill-dry-run`, `backfill`, or `replay-skipped` against the test database and sandbox API host (pinned in the workflow). CI builds `@auction/db` and `@auction/persistence` only (tsx runs worker scripts); do not set job-level `NODE_ENV=production` before `pnpm install` or TypeScript builds lose `@types/node`.

## Worker env (CRM)

| Variable | Purpose |
|----------|---------|
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | OAuth |
| `ZOHO_CRM_API_HOST` | CRM API base (sandbox in test) |
| `ZOHO_CRM_EXPECTED_ORG_TYPE` | `sandbox` or `production` — startup org check (`canary`/`live` only) |
| `ZOHO_CRM_SYNC_MODE` | `off` \| `dry_run` \| `canary` \| `live` |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | Comma-separated allowlist (**required** whenever `ZOHO_CRM_SYNC_MODE` is not `off`; worker env validation fails if empty) |
| `ZOHO_CRM_UPSERT_TRIGGER` | JSON array; default `[]` suppresses workflows |
| `ZOHO_CRM_AUCTION_PIPELINE` | Deal pipeline name (required before deal events write) |
| `ZOHO_CRM_DEAL_STAGE_*` | Stage names per milestone (required when that event type is enabled) |
| `ZOHO_CRM_LEAD_CONVERSION_ENABLED` | `true` to allow Convert Lead on `bid.lot_won` (default `false`) |
| `ZOHO_CRM_CURSOR_BATCH_SIZE` | Domain events ingested into the delivery ledger per projector tick (default `100`) |
| `ZOHO_CRM_TICK_TIME_BUDGET_MS` | Max ms per projector tick spent claiming and running Zoho deliveries (one claim at a time) |

Production worker keeps `ZOHO_CRM_SYNC_MODE=off` until [Phase 0 runbook](../runbooks/zoho-crm-phase0-prerequisites.md) exit criteria pass.

**Not implemented yet:** automated dead-letter alerting; shop refund/fulfilment events (no producers).

## Architecture

- Domain events → `zoho` projector → `CrmSyncService` (dispatcher) → person/deal/lifecycle handlers → `CrmGateway` (Zoho adapter + rate limiter, wired in the worker container).
- Idempotency: Zoho external fields (`LAX_Subject_ID`, `LAX_Deal_Key`) + `crm_record_link` (including tombstones and persisted deletion-request flags).
- Deliveries use `domain_event_delivery` with explicit **`skipped`** status (dry run, disabled type, policy) and `replay:crm-skipped` script for skipped rows.
- Metrics: `auction_zoho_crm_api_credits_remaining` (from `X-API-CREDITS-REMAINING` when present); `auction_delivery_oldest_pending_age_seconds{consumer="zoho"}`; `auction_delivery_dead_letter_total{consumer="zoho"}`.

## Event mapping (catalog consumers)

- Identity: `user.registered`, `user.email_verified`, `user.profile_updated`, `user.deletion_requested`, `user.deletion_cancelled`, `user.identity_merged`, `user.identity_deleted`  
  **Lifecycle** (`deletion_*`, `identity_merged`, `identity_deleted`) is always delivered when any person event type is allowlisted, even if omitted from `ZOHO_CRM_ENABLED_EVENT_TYPES`.
- Bid: `bid.first_for_user`, `bid.lot_won`, `payment.captured`, `payment.refunded`
- Shop: `shop.order.paid` only (refund/fulfilment not emitted yet). Deal patches require an existing person link — run `backfill:crm-users` for shop-only buyers before enabling shop CRM events.

**Enable order (test/canary):** turn on `user.registered` and run `backfill:crm-users` before any patch-only types (`user.email_verified`, `user.profile_updated`, `bid.first_for_user`) or deal/payment events. Patch handlers retry then dead-letter when the subject has no CRM link yet.

Registrants upsert **Leads** with `Lead_Source = LAX Platform`. Lot win may convert Lead → Contact when `ZOHO_CRM_LEAD_CONVERSION_ENABLED=true`, then creates a Deal keyed by `LAX_Deal_Key`.

## Ops scripts

```bash
pnpm --filter @auction/worker backfill:crm-users [--dry-run]
pnpm --filter @auction/worker reconcile:crm-links
pnpm --filter @auction/worker replay:crm-skipped
```

See [async-delivery-phase-two.md](../runbooks/async-delivery-phase-two.md) for rollout and dead-letter handling.
