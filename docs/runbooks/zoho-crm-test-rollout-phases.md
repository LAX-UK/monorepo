# Zoho CRM test rollout phases (sandbox)

Prerequisites: [zoho-crm-phase0-prerequisites.md](./zoho-crm-phase0-prerequisites.md) and [zoho.md](../integrations/zoho.md).

After each phase, re-run **Terraform test up** (with image contracts) so the worker picks up GitHub **test** environment variables.

## Execution log (2026-09-29)

| Step | Status |
|------|--------|
| Infra TF vars + monorepo workflows + backfill org guard | Shipped (auction-infra #24, monorepo #402) |
| Maintenance workflow CI | Fixed on main (#404 db/persistence build, #405 NODE_ENV scoping) |
| Phase 1 maintenance | `backfill-dry-run` OK (43 eligible); `backfill` **40 success / 3 `INVALID_DATA`** (row-level: subjects `7ETkWP5P…`, `Asao9KOw…`, `xR4WD3UL…`); `replay-skipped` replayed **2** `user.registered`. Phase 1 **still open** until signup Lead + `delivery-status` shows those deliveries `succeeded`. |
| Phase 2 GitHub var | `ZOHO_CRM_ENABLED_EVENT_TYPES` set to person-patch allowlist — worker env **not applied** until Terraform test up succeeds (runs [36514777641](https://github.com/LAX-UK/monorepo/actions/runs/36514777641), [36515552378](https://github.com/LAX-UK/monorepo/actions/runs/36515552378) failed: missing contracts / bad shop-identity digest). |
| Phase 3–4 | Pending Phase 0 UI checks, Terraform apply, E2E, GDPR, 24h soak |

Row-level `INVALID_DATA` with 40/43 successes is not a missing-org-field scenario; re-run `backfill` after the worker logs `fieldApiName` from Zoho, then fix those rows or the mapper.

**Terraform test up image contracts:** copy inputs from the last green run ([36456765871](https://github.com/LAX-UK/monorepo/actions/runs/36456765871)) or resolve tag + digest pairs from DOCR before dispatch (never retype digests):

```bash
for repo in lax-test-identity lax-test-shop-identity lax-test-shop lax-test-shop-api; do
  echo "=== $repo ==="
  doctl registry repository list-tags "$repo" -o json \
    | jq -r '.[] | select(.tag | test("^[a-f0-9]{40}$")) | "\(.tag) \(.manifest_digest)"' \
    | head -3
done
```

Pass the chosen tag as each `*_sha` workflow input and the matching `manifest_digest` as each `*_digest`.

## Phase 1 — canary `user.registered`

| Variable | Value |
|----------|--------|
| `ZOHO_CRM_SYNC_MODE` | `canary` |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | `user.registered` |

Verify: register on `https://test-auth.lax.bid/sign-up`; worker logs show successful Zoho delivery (not `zoho_crm_dry_run`); sandbox Lead has `LAX_Subject_ID` and `Lead_Source = LAX Platform`.

Maintenance (order): **Zoho CRM maintenance (test)** → `backfill-dry-run`, `backfill`, `replay-skipped`, then `delivery-status` to confirm ledger rows (no payloads logged).

## Phase 2 — person patches

| Variable | Value |
|----------|--------|
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | `user.registered,user.email_verified,user.profile_updated,bid.first_for_user` |

Verify: email verify + profile edit patch the Lead/Contact.

## Phase 3 — deals + lead conversion

| Variable | Value |
|----------|--------|
| `ZOHO_CRM_AUCTION_PIPELINE` | `LAX Platform` |
| `ZOHO_CRM_DEAL_STAGE_LOT_WON` | `Lot Won` |
| `ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED` | `Paid` |
| `ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED` | `Refunded` |
| `ZOHO_CRM_DEAL_STAGE_SHOP_PAID` | `Paid` |
| `ZOHO_CRM_LEAD_CONVERSION_ENABLED` | `true` |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | add `bid.lot_won,payment.captured,payment.refunded,shop.order.paid` |

Verify: lot win → Contact + Deal at Lot Won; Stripe test payment → Paid; refund → Refunded; Shop order → Paid deal.

## Phase 4 — GDPR and live

Run deletion drill and reconciliation per [async-delivery-phase-two.md](./async-delivery-phase-two.md). Then `ZOHO_CRM_SYNC_MODE=live` with full allowlist; 24h soak on delivery metrics.
