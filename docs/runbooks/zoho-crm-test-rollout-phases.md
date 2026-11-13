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
| `ZOHO_CRM_LEAD_STATUS_NEW` | `New` (the sandbox picklist has no `New (Unassigned)`) |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | add `bid.lot_won,payment.captured,payment.refunded,shop.order.paid` |

Verify: lot win → held deal (no Deal until an admin converts the lead); after conversion → Deal at Lot Won on the Contact; Stripe test payment → Paid; refund → Refunded; Shop order → Paid deal.

## Phase 4 — GDPR and live

Run deletion drill and reconciliation per [async-delivery-phase-two.md](./async-delivery-phase-two.md). Then `ZOHO_CRM_SYNC_MODE=live` with full allowlist; 24h soak on delivery metrics.

## Enquiry leads (off by default)

Enquiries sent through the contact form or the private sale page can create a Lead in Zoho. Nothing is sent until the switch below is on.

| Setting | Value |
|---------|--------|
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | add `marketing_enquiry.received` |
| `ZOHO_CRM_SYNC_MODE` | not `off` (use `dry_run` first to see the event in logs without sending) |

Before enabling, create these custom Lead fields in Zoho (single line text): `LAX_Enquiry_Intent`, `LAX_Department`, `LAX_Enquiry_Reference`.

What is sent: name, email, phone, `Lead_Source_Detailed = LAX Bid enquiry`, intent (Sell privately, Buy privately or General), department, enquiry reference, and `Email_Opt_Out` (true unless the sender agreed to marketing). Never sent: the message, the price in mind, attachments.

Matching: a signed-in sender reuses their account's Lead; a guest gets a Lead keyed by the enquiry and matched to an existing Lead by email. Repeating an event updates the same Lead and `crm_record_link` row.

To turn it off, remove `marketing_enquiry.received` from the allowlist and redeploy the worker. Skipped deliveries can be replayed with `replay:crm-skipped` once it is on again.

## When Zoho refuses a new registration (`zoho_crm_http_400`)

Failed jobs › Integrations shows why Zoho refused a delivery as `zoho_crm_http_<status>:<ZOHO_CODE>:<field API name>`, for example `zoho_crm_http_400:INVALID_DATA:Lead_Source`. Only Zoho's error code and the field's API name are kept; Zoho's message, the field value and the person's details are never stored or logged. The worker logs the same reason as `zoho_crm_delivery_failed`. Deliveries that failed before this change show the bare `zoho_crm_http_400`; press **Retry** to get the reason (or a success).

What the worker does by itself:

- **Optional field refused (`INVALID_DATA` on a field other than `Email`, `Last_Name` or `LAX_Subject_ID`):** the field is left out and the lead is sent again, so the person is still recorded. Each field left out is logged as `zoho_crm_person_field_dropped` with its API name. Fix the setting in Zoho so the field is filled again for new sign-ups.
- **`Last_Name`:** always sent. A one-word name is the surname, no name uses the email's local part, then `Customer`; names are cut to Zoho's lengths (First 40, Last 80).
- **UTM fields and `Landing_Page_URL`:** cut to 255 characters; a long landing page loses its query string first.

What to check in Zoho (LAX Integration Test sandbox, Setup › Customization › Modules › Leads), by the code in the reason:

| Reason | Check |
|--------|-------|
| `INVALID_DATA:Lead_Source` | The Lead Source picklist has the value `Website` (or the picklist is not restricted). |
| `INVALID_DATA:Lead_Status` | The Lead Status picklist has the value in `ZOHO_CRM_LEAD_STATUS_NEW` (default `New (Unassigned)`). |
| `INVALID_DATA:Enquiry_Type` | The Enquiry Type picklist has `General`. |
| `INVALID_DATA:Lead_Source_Detailed` | The field is single line text (255), or, if it was made a picklist, it has `LAX Account sign-up`. |
| `INVALID_DATA:LAX_Subject_ID` or `:duplicate_check_fields` | `LAX_Subject_ID` exists on Leads and Contacts, is single line text and is marked unique ("Do not allow duplicate values"); upsert matches on it, then on Email. |
| `MANDATORY_NOT_FOUND:<field>` | Someone made `<field>` mandatory on the Leads layout (for example a "Signed up with" field). The platform does not send it: make it optional for the integration user's layout, or ask for it to be mapped. |
| `DUPLICATE_DATA:<field>` | `<field>` is unique in Zoho and another Lead or Contact already holds the value. Merge the records in Zoho, then Retry. |
| `INVALID_QUERY:<column>` | The integration user lost field access to `<column>` on Contacts or Leads (the email lookup runs before the upsert). |

Also confirm the integration user's profile can create Leads, that its default Leads layout has no new mandatory fields, and that no validation rule or blueprint on Leads blocks API-created records.

Retrying is safe: each attempt looks the person up by email, then upserts with `duplicate_check_fields = [LAX_Subject_ID, Email]`, so a lead created by an earlier attempt is updated, not duplicated, and the `crm_record_link` row is written once.
