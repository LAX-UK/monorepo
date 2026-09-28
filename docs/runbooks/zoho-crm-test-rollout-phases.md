# Zoho CRM test rollout phases (sandbox)

Prerequisites: [zoho-crm-phase0-prerequisites.md](./zoho-crm-phase0-prerequisites.md) and [zoho.md](../integrations/zoho.md).

After each phase, re-run **Terraform test up** (with image contracts) so the worker picks up GitHub **test** environment variables.

## Phase 1 — canary `user.registered`

| Variable | Value |
|----------|--------|
| `ZOHO_CRM_SYNC_MODE` | `canary` |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | `user.registered` |

Verify: register on `https://test-auth.lax.bid/sign-up`; worker logs show successful Zoho delivery (not `zoho_crm_dry_run`); sandbox Lead has `LAX_Subject_ID` and `Lead_Source = LAX Platform`.

Maintenance (order): **Zoho CRM maintenance (test)** → `backfill-dry-run`, `backfill`, `replay-skipped`.

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
