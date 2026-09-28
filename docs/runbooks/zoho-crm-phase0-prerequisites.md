# Zoho CRM integration — Phase 0 prerequisites

Complete these in the **LAX Integration Test** sandbox before enabling `ZOHO_CRM_SYNC_MODE=live` in test.

## Sandbox and credits

1. Confirm **Zoho One** and daily API credits under Setup → Developer Hub → APIs.
2. Use sandbox **LAX Integration Test** (Partial Data). Do **not** use **LAX Sand Box** for integration work.

## Schema (UI unless Module Customization MCP can set external flag)

| Item | Module | Status |
|------|--------|--------|
| `LAX_Subject_ID` (external, org-based) | Leads | Present (`external.type=org`; MCP 2026-09-28) |
| `LAX_Subject_ID` (external, org-based) | Contacts | Present; enable **external (org-based)** in UI if metadata shows `external: null` |
| `LAX_Deal_Key` (external, org-based) | Deals | Present (MCP 2026-09-28); confirm external + unique in UI |
| `Lead_Source_Detailed`, `Eligibility_LAX_*`, `UTM_*`, `Landing_Page_URL` | Contacts | Present (MCP 2026-09-28) |
| Picklist value `LAX Platform` | Leads + Contacts `Lead_Source` | Present (`type=used` on both; MCP 2026-09-28) |
| **LAX Platform** pipeline (recommended) | Deals | Create in sandbox — do **not** reuse **LAX Art Sales Pipeline** (human sales). Stages: **Lot Won** (Open 90%), **Paid** (Closed Won 100%), **Refunded** (Closed Lost 0%). Map to GitHub test vars `ZOHO_CRM_AUCTION_PIPELINE` and `ZOHO_CRM_DEAL_STAGE_*` with **exact** API names. |

Optional engagement fields used by sync when present: `First_Bid_At`, `Shop_First_Order_At`.

### COQL erasure check (GDPR)

Run once in the sandbox (replace `<contactId>` with a test Contact id):

```sql
select id from Deals where Contact_Name = '<contactId>' limit 200
```

The worker uses the same predicate in `findDealIdsByContact`. If COQL rejects `Contact_Name` filtering, fix field/layout access before enabling erasure events.

### Pipeline / env wiring checklist

1. CRM owner confirms pipeline name and stage labels in Zoho UI.
2. Test worker env: `ZOHO_CRM_AUCTION_PIPELINE`, `ZOHO_CRM_DEAL_STAGE_LOT_WON`, `ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED`, `ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED`, `ZOHO_CRM_DEAL_STAGE_SHOP_PAID`.
3. GitHub **test** environment: OAuth secrets (`ZOHO_CLIENT_*`, `ZOHO_REFRESH_TOKEN`); CRM **variables** per [zoho.md](../integrations/zoho.md). Rollout: `dry_run` → `canary` → `live` via `ZOHO_CRM_SYNC_MODE`.
4. **Lead conversion:** set `ZOHO_CRM_LEAD_CONVERSION_ENABLED=true` when testing `bid.lot_won` (requires Contacts `LAX_Subject_ID` external).

### Sandbox vs production MCP (2026-09-29)

Confirm Zoho MCP and OAuth token target **LAX Integration Test** sandbox, not production. Module-customization MCP showed full LAX fields; a separate data-insights connection lacked `LAX_Subject_ID` on Leads — treat missing fields as wrong org until verified in UI.

### Token / org gate (before `canary`)

1. Exchange refresh token at `https://accounts.zoho.eu/oauth/v2/token`.
2. `GET https://sandbox.zohoapis.eu/crm/v8/org` — `org[0].type` must indicate sandbox (worker startup check).
3. Fix Contacts `LAX_Subject_ID` external flag and Deals `LAX_Deal_Key` unique if not already set.

## Automation review (Step 6)

Install **Workflow & Process Automation** MCP against the sandbox, or export a manual list of workflows on **Leads**, **Contacts**, and **Deals** create/update. Convert Lead cannot suppress workflows.

## Integration user and OAuth (secrets never in chat)

1. Create integration user + **API Integration** profile (Leads, Contacts, Deals, COQL read, recycle bin delete, org read).
2. Self-client or server-based OAuth on **accounts.zoho.eu**; generate refresh token while switched to **LAX Integration Test**.
3. Store in GitHub **test** environment only: `TF_VAR_zoho_client_id`, `TF_VAR_zoho_client_secret`, `TF_VAR_zoho_refresh_token`.

Required scopes:

- `ZohoCRM.modules.leads.ALL`
- `ZohoCRM.modules.contacts.ALL`
- `ZohoCRM.modules.deals.ALL`
- `ZohoCRM.settings.fields.READ`
- `ZohoCRM.coql.READ`
- `ZohoCRM.settings.recycle_bin.DELETE`
- `ZohoCRM.org.READ`

## Business sign-off (Step 10)

- CRM owner: writable fields and pipeline stage names (must match worker env vars).
- DPO: lawful basis for pushing registrants into CRM; consent fields remain human-owned in Zoho until the platform stores consent.

## Exit to live in test

Follow [async-delivery-phase-two.md](./async-delivery-phase-two.md): `dry_run` → `canary` → `live`, backfill trial, reconciliation report, GDPR erasure drill, zero unexplained dead letters.
