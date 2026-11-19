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
| `ZOHO_CRM_LEAD_STATUS_NEW` | `New (Unassigned)` | Lead Status a new website lead starts with; must exist in the org's Lead Status picklist (the sandbox has `New`) |

`SHOP_ZOHO_CATALOGUE_SYNC_ENABLED` is not in this table because no monorepo workflow passes it; see the list below.

**Set in the infra repo, not by these workflows.** The monorepo Terraform workflows do not pass the variables below as `TF_VAR_*`, so the worker and shop-api get them only if the private infra repo sets them on the app spec; otherwise the app's own default applies. This document does not record the values infra sets; check the infra repo before relying on one.

| Variable | App | Default when unset | Notes |
|----------|-----|--------------------|-------|
| `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED` | worker | `false` | `shop.artwork.created` → Products is skipped while `false` |
| `SHOP_ZOHO_FINANCIALS_ENABLED` | worker | `false` | Order financials on `shop.order.paid` |
| `ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE` | worker | `off` | See [Campaigns suppression](#campaigns-suppression-inbound) |
| `ZOHO_CRM_EXPECTED_ORG_TYPE` | worker | unset | Must be `sandbox` on test before any Zoho mode there goes `canary`/`live`; without it the worker refuses to start |
| `ZOHO_ARTWORK_WRITEBACK_MODE`, `ZOHO_ARTWORK_LISTING_MODE`, `ZOHO_FULFILMENT_MIRROR_MODE` | shop-api | unset | shop-api's copies, used only to word the [mirror status](#mirror-status-per-record-lax-admin-read); unset, the badge says only what the delivery ledger shows. The workflows pass these modes to the worker only; set them to the worker's values |

After changing vars, re-run **Terraform test up** (with image contracts) or **Terraform apply test** so the worker spec updates.

**Zoho CRM maintenance (test)** workflow (`zoho-crm-maintenance-test.yml`): manual `backfill-dry-run`, `backfill`, `replay-skipped`, or read-only `delivery-status` (counts and recent retry/dead-letter rows from `domain_event_delivery`; no event payloads). Backfill exits non-zero when any Zoho row returns an error. CI builds `@auction/db` and `@auction/persistence` only (tsx runs worker scripts); do not set job-level `NODE_ENV=production` before `pnpm install` or TypeScript builds lose `@types/node`.

## Worker env (CRM)

### Canary is live

`ZOHO_CRM_SYNC_MODE=canary` does exactly what `live` does; nothing in the worker tells them apart. In both, the CRM sync sends allowlisted events to Zoho over HTTP (`resolveZohoDeliveryMode` in `zoho-crm-config.ts`; the projector only branches on `off`, `disabled_type` and `dry_run`), the held-deal release sweep runs (`zoho-projector.ts`), the startup org check runs and, outside production, `ZOHO_CRM_EXPECTED_ORG_TYPE` must be `sandbox` (`writesToZohoCrm` in `zoho-live-modes.ts`), and `backfill:crm-users` writes. The only difference is the word in the logs and env. What makes a rollout a canary is the allowlist, `ZOHO_CRM_ENABLED_EVENT_TYPES`, which narrows `live` in the same way: a "canary" is `live` (or `canary`) with a short allowlist. The artwork, listing, stock location, fulfilment and QC modes have no `canary`.

| Variable | Purpose |
|----------|---------|
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | OAuth |
| `ZOHO_CRM_API_HOST` | CRM API base (sandbox in test) |
| `ZOHO_CRM_EXPECTED_ORG_TYPE` | `sandbox` or `production` — startup org check (`canary`/`live` only) |
| `ZOHO_CRM_SYNC_MODE` | `off` \| `dry_run` \| `canary` \| `live`. `canary` and `live` behave the same in every way (see [Canary is live](#canary-is-live)) |
| `ZOHO_CRM_ENABLED_EVENT_TYPES` | Comma-separated allowlist (**required** whenever `ZOHO_CRM_SYNC_MODE` is not `off`; worker env validation fails if empty) |
| `ZOHO_CRM_UPSERT_TRIGGER` | JSON array; default `[]` suppresses workflows |
| `ZOHO_CRM_AUCTION_PIPELINE` | Deal pipeline name (required before deal events write) |
| `ZOHO_CRM_DEAL_STAGE_*` | Stage names per milestone (required when that event type is enabled) |
| `ZOHO_CRM_LEAD_STATUS_NEW` | Lead Status written when the platform creates a lead (default `New (Unassigned)`) |
| `ZOHO_CRM_CURSOR_BATCH_SIZE` | Domain events ingested into the delivery ledger per projector tick (default `100`) |
| `ZOHO_CRM_TICK_TIME_BUDGET_MS` | Max ms per projector tick spent claiming and running Zoho deliveries (one claim at a time) |

Production worker keeps `ZOHO_CRM_SYNC_MODE=off` until [Phase 0 runbook](../runbooks/zoho-crm-phase0-prerequisites.md) exit criteria pass.

**Shop:** catalogue sync requires the env var above. A Shop original enquiry creates a Lead and needs no stage variable. A Shop refund uses `ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED`, as a Bid refund does; fulfilment milestones add notes and need no stage variable.

## Architecture

- Domain events → `zoho` projector → `CrmSyncService` (dispatcher) → person/deal/lifecycle handlers → `CrmGateway` (Zoho adapter + rate limiter, wired in the worker container).
- Idempotency: Zoho external fields (`LAX_Subject_ID`, `LAX_Deal_Key`) + `crm_record_link` (including tombstones and persisted deletion-request flags).
- Deliveries use `domain_event_delivery` with explicit **`skipped`** status (dry run, disabled type, policy) and `replay:crm-skipped` script for skipped rows.
- Metrics: `auction_zoho_crm_api_credits_remaining` (from `X-API-CREDITS-REMAINING` when present); `auction_delivery_oldest_pending_age_seconds{consumer="zoho"}`; `auction_delivery_dead_letter_total{consumer="zoho"}`.

## Event mapping (catalog consumers)

Every event type the `zoho` consumer receives. Each one writes to Zoho only when it is listed in `ZOHO_CRM_ENABLED_EVENT_TYPES` (or is always-on, below); otherwise its delivery is recorded as `skipped` and `replay:crm-skipped` can send it later. No default enables any of them.

| Event type | What it does in Zoho CRM |
| --- | --- |
| `user.registered` | Creates or updates the person's Lead (`LAX Account sign-up`); a person who is already a Contact is updated. |
| `user.email_verified` | Patches `Email` on the person's Lead or Contact. |
| `user.profile_updated` | Patches name, email and phone on the person's Lead or Contact. |
| `user.deletion_requested` | Flags the person in the ledger; deal writes for them are then skipped (`deletion_requested`). Always-on when any person event type is enabled. |
| `user.deletion_cancelled` | Clears that flag. Always-on when any person event type is enabled. |
| `user.identity_merged` | Merges the retired subject's CRM links (person and deals) into the kept subject in the ledger. Always-on when any person event type is enabled. |
| `user.identity_deleted` | Deletes the person's Lead/Contact, platform notes and tasks, and purges them from the recycle bin. Always-on when any person event type, or `marketing_enquiry.received`, is enabled. |
| `marketing_enquiry.received` | Creates or updates a Lead for a Bid enquiry (private sale or contact form). |
| `bid.first_for_user` | Sets `Eligibility_LAX_Bid` on the person. |
| `bid.lot_won` | Creates the lot's Deal at `ZOHO_CRM_DEAL_STAGE_LOT_WON`, or holds it until the buyer has a Contact. |
| `payment.captured` | Moves the lot's Deal (or held deal) to `ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED`; a buyer with no Contact gets the paying-buyer steps below. |
| `payment.refunded` | Moves the lot's Deal to `ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED`. A held deal is skipped (`deal_held_until_contact`). |
| `shop.order.paid` | Creates the order's Deal at `ZOHO_CRM_DEAL_STAGE_SHOP_PAID`, or holds it with the paying-buyer steps below; sends order financials when `SHOP_ZOHO_FINANCIALS_ENABLED`. |
| `shop.refund.completed` | A succeeded Shop refund moves the order's Deal to `ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED`, as `payment.refunded` does for a lot. A failed refund is skipped (`refund_not_succeeded`); a held deal is skipped (`deal_held_until_contact`). While the order has no deal link yet (its `shop.order.paid` is still retrying or not handled), the refund is retried (`deal_link_missing`) under the usual retry and dead-letter policy, so the deal is moved once it exists. **Known gap:** a refund on a deal still held for a Contact is skipped and not applied when the deal is later released, so that deal is created at the paid stage (same as Bid). |
| `shop.fulfilment.status_changed` | At a milestone, adds one Note to the order's Deal: `in_transit` → "Shop order dispatched", `delivered` → "Shop order delivered", `collected` → "Shop order collected". The note carries the milestone only. Other statuses are skipped (`fulfilment_status_not_milestone`); a held deal is skipped (`deal_held_until_contact`). The note is recorded in `crm_record_link` (`note` row keyed `fulfilment:<fulfilment id>:<status>`), so a redelivery never adds it twice, and it is deleted with the person's other platform notes on erasure. The row is written as pending (`__note_pending__`) before the note is sent and made real after; a refused or failed send sets it back so the retry sends again, and a row left pending (the note was sent, then the ledger write failed) means the note is not sent again (`deal_note_maybe_added`): at most once, never twice. |
| `shop.artwork.created` | Upserts a Zoho Product, only with `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED`. |
| `shop.artwork.interest_registered` | A signed-in enquiry about a Shop original creates or updates a Lead (`LAX Shop enquiry`); `notify_me` interest is skipped. |
| `shop.guest_lead.recorded` | Creates or updates a guest Lead (`LAX Shop guest`). |
| `shop.guest_lead.claimed` | Merges the guest lead into the account that claimed it. |
| `shop.guest_lead.erased` | Deletes and purges the guest Lead. Always-on when `shop.guest_lead.recorded` or `marketing_enquiry.received` is enabled. |
| `shop.stock_hold.expired`, `shop.third_party_sale.recorded`, `shop.sale_fee.approved` | Routed to the consumer but not mapped: always skipped (`unmapped_event`). |
| `shop.refund.reversed` | Not routed to the CRM consumer yet: after a Stripe refund reversal the deal stays at the refunded stage. |

Deal events (lot won, payments, Shop order, refunds, fulfilment notes) require an existing person link — run `backfill:crm-users` for shop-only buyers before enabling them. The Shop fulfilment mirror (`zoho_fulfilment`, `ZOHO_FULFILMENT_MIRROR_MODE`) also hears `shop.fulfilment.status_changed`; it writes the Dispatch/Framing modules, not the Deal, and is unaffected by this allowlist.

**Enable order (test/canary):** turn on `user.registered` and run `backfill:crm-users` before any patch-only types (`user.email_verified`, `user.profile_updated`, `bid.first_for_user`) or deal/payment events. Patch handlers retry then dead-letter when the subject has no CRM link yet.

### Website leads and admin conversion

The platform never converts a lead. Clients are created only when an admin converts a lead in Zoho (`ZOHO_CRM_LEAD_CONVERSION_ENABLED` and the Convert Lead call are gone).

**Lead fields.** Every lead the platform creates or updates carries these. "Create only" fields are sent when the platform creates the lead and never again, so an admin's later edit is never overwritten.

| Owners' field | Zoho API name | Source | Written |
| --- | --- | --- | --- |
| Lead Status | `Lead_Status` | `ZOHO_CRM_LEAD_STATUS_NEW` (`New (Unassigned)`) | create only |
| Lead Source (Primary) | `Lead_Source` | `Website` | create only |
| Lead Source (Detailed) | `Lead_Source_Detailed` | product and form: `LAX Account sign-up`, `LAX Bid enquiry`, `LAX Bid private sale enquiry`, `LAX Shop guest <source>: <status>`, `LAX Shop enquiry: <stock code> <link to the work> <title>` (the link is left out when `LAX_ART_PUBLIC_URL` is not set) | every sync |
| Enquiry Type | `Enquiry_Type` | enquiry intent and department (below); sign-ups `General`; Shop guest leads `Prints` | every sync |
| Interest: Artist | `Interested_Artist` | artist named on a private sale enquiry | when known |
| Interest: Collection | `Interested_Collection` | none yet: no form records a stock code | not sent |
| Marketing Opt-In | `Consent_Marketing_Opt_In` | consent recorded with the enquiry or guest checkout; `false` when not given | every sync of a consent-recording form |
| Consent Timestamp | `Consent_Timestamp` (date) | day the opt-in was recorded; only with an opt-in | with an opt-in |
| Consent Source | `Consent_Source` | `Website`; only with an opt-in | with an opt-in |
| Consent wording | `Consent_Wording_Version` | Shop guest checkout wording version | with an opt-in |
| Data Processing Notice Confirmed | `Data_Processing_Notice_Confirmed` | `true` on enquiry and guest checkout forms (they show the notice) | every sync of those forms |

Sign-ups (`user.registered`) record no marketing consent, so no consent fields are sent and the lead is never opted in. `Email_Opt_Out` mirrors the opt-in. Visitor alert sign-ups do not create leads. Lead-only fields are not sent when the person is already a Contact.

Enquiry Type: department `prints`/`editions` is Prints, `corporate` is Corporate, `auction(s)` is Auction; otherwise intent `private_sale_buy`/`buying` is Original, `private_sale_sell`/`selling` is Auction, anything else General.

**Paying buyer.** When a lot is won and paid (`payment.captured`), or a Shop order is paid (`shop.order.paid`), and the person has no Contact yet:

1. Their Lead Status becomes `Qualified`, but only from `New`, `New (Unassigned)`, `Assigned` or `Contacted`. Any other status (`Not Proceeding`, `Meeting Booked`, `Converted to Client`, ...) is left alone.
2. A Note on the lead records the purchase: deal name, amount, date and product.
3. A Task `Paid customer: please convert` is created on the lead, due the next day (London), owned by the lead owner when there is one, else Zoho's default owner.
4. The deal is **held**, not created: no Deal exists without a Contact.

**Held deals.** A held deal is a row in `crm_record_link` (`entity_type = 'deal'`, `zoho_module = '__held__'`) whose fields wait in `held_payload`. The note and task are recorded in the same table (`note`/`task` rows keyed `paid-customer:<deal id>`), so a retry never doubles them. A Contact that already exists (found by link or email) gets its deals directly.

**Release.** The worker re-checks each held deal's lead at most every 15 minutes (ten per tick, oldest check first, `canary` and `live` only): it reads the lead (`GET /Leads/{id}`) and, once `Converted_Detail.contact` is present, links the subject to the new Contact, sets `LAX_Subject_ID` on it and creates the waiting Deals on that Contact (keyed by `LAX_Deal_Key`, so repeating is safe). It also runs when a later sync finds the person's Contact. Polling the lead was chosen over a Zoho webhook because it needs no Zoho workflow, secret or public endpoint, and a missed notice cannot strand a deal.

**Erasure.** Erasing a person also deletes their purchase notes and tasks in Zoho (and empties the recycle bin) and drops their held deals with the stored fields, before the lead itself is deleted.

## Artworks from Zoho Products (inbound)

Zoho CRM **Products** is the catalogue; the artwork register in LAX mirrors it. Zoho owns the catalogue fields (title, artist, medium, dimensions, year, status) and LAX owns the stock code, kind and where a piece is offered. A change to a LAX-owned field in Zoho is never applied: it becomes an open conflict for staff.

Changes arrive two ways and are processed identically:

1. **Notice with a shared secret.** A Zoho workflow rule posts to `POST /webhooks/zoho/artworks` when a Product is created or edited. The API checks the shared secret (`X-LAX-Webhook-Secret`, compared in constant time), stores the notice in `webhook_event` (source `zoho_artwork`, idempotent on Product id and modified time), queues it on the `webhook-events` queue and answers `202`. The worker then reads that Product from Zoho (COQL) and processes it.
2. **Nightly check** (02:30 Europe/London, same queue). Reads every Product with `Modified_Time` after the stored watermark. With no watermark it reads all Products: that first pass is the import report. The watermark only moves after a whole pass finishes, and is kept per mode, so switching `dry_run` to `live` starts a fresh full pass.

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_ARTWORK_SYNC_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `off` consumes notices and does nothing; `dry_run` records what would happen and changes nothing in the register; `live` creates and updates register records. Not `off` requires the three OAuth values and `WEBHOOK_EVENTS_PROCESS=true`. |
| `ZOHO_ARTWORK_WEBHOOK_SECRET` | api | Shared secret, 32+ characters. Unset, the route answers `503` and stores nothing. |

**OAuth scopes** the refresh token needs on top of the list above: `ZohoCRM.modules.products.READ`, `ZohoCRM.modules.custom.READ` (Artists) and `ZohoCRM.coql.READ`. Generate a new refresh token after adding scopes.

**Outcomes.** Each Product in a pass gets one row in `zoho_artwork_sync_outcome` (`run_id`, e.g. `nightly:dry_run:2026-11-03` or `notice:<event key>`): `create`, `update`, `conflict`, `unchanged`, `stale` or `skipped` with a reason (`demo_artist`, `missing_title`, `missing_stock_code`, `invalid_stock_code`, `missing_artist`, `missing_artist_code`, `duplicate_stock_code`, `not_found_in_zoho`, `invalid_modified_time`), plus gaps worth attention (`missing_price`, `missing_medium`, `missing_dimensions`, `artist_code_differs_from_stock_code`) and, for updates, each field's old and new value. Artists whose name starts `DEMO - ` are skipped. New records are created `held`; nothing is listed anywhere automatically.

```sql
-- the import report for a pass
select outcome, reason, count(*) from zoho_artwork_sync_outcome
where run_id = 'nightly:dry_run:2026-11-03' group by 1, 2 order by 3 desc;
```

**Failures.** A failed notice is marked failed on its `webhook_event` row and retried by the queue and the 60 second drain (up to 10 attempts); it then shows on Failed jobs under Integrations as a webhook. A failed nightly check is a failed job on the `webhook-events` queue and shows under background jobs. Data problems on a single Product (no stock code, unknown artist) are `skipped` outcomes, not failures.

**Zoho workflow rule** (Setup, Automation, Workflow Rules, Products):

1. Rule name `LAX artwork notice`; module Products; when a record is `Created or Edited`; condition `All Products`; execute `Every time`.
2. Instant action, Webhook. Name `LAX artwork notice`. URL `https://<api host>/webhooks/zoho/artworks`, method `POST`.
3. Headers: `X-LAX-Webhook-Secret` = the value of `ZOHO_ARTWORK_WEBHOOK_SECRET`.
4. Body type `Raw`, content type `application/json`:
   `{"productId":"${Products.Product Id}","modifiedTime":"${Products.Modified Time}"}`
   (insert both with the merge-field picker so the exact tokens are used; `modifiedTime` is optional, `productId` is required).
5. Save and activate. Test by editing a Product and checking `webhook_event` for a `zoho_artwork` row.

Roll out in this order: sandbox org with `dry_run`; review the first nightly report; then production with `dry_run`; switch to `live` only after the report is approved.

## Sold in the gallery (inbound)

Gallery staff mark an artwork sold by setting the Zoho Product's `Status` to `Sold`. Zoho is the source of truth: LAX records the artwork as **sold in the gallery** (register `offer_state = 'sold'`, reference `gallery_sale` naming the Product), with no person deciding. The rules are pure, in `packages/artwork-register-contracts/src/sold-in-gallery.ts` (`planGallerySale`, `reopenGallerySale`).

| Where the artwork is | What LAX does |
|----------------------|---------------|
| Not offered or withdrawn | Records the sale. |
| On lax.art | Raises the "Zoho says Sold" item first (payments for the artwork are held from that moment), then records the sale. LAX Shop takes every lax.art listing linked to the Product off sale (unpublished, not archived), audited as `system:shop-scheduler`. |
| In a LAX Bid sale or a private sale | Records nothing yet. The existing "Zoho says Sold, but this artwork is still for sale" item asks staff to withdraw it there; the next pass (notice or nightly) then records the sale. |
| Already sold, however | Nothing. A repeated notice or LAX's own write-back is a no-op. |

**Open checkouts and invoices are held, never cancelled.** The hold is the existing money pause: while the item is open, lax.art checkout and the re-offer steps are refused and a payment that still arrives goes to finance instead of fulfilment. The pause is also on for as long as the register records the gallery sale (`sold` with ref `gallery_sale`), whatever became of the item, so no lax.art money path completes for a work Zoho says Sold; only Reopen lifts it. Once the sale is recorded the item reads "Sold in the gallery: check for an open checkout or invoice" and stays open (it no longer closes by itself) until staff cancel or refund what was open where it lives and press **Dealt with** (`artwork_register.review`, with a recent sign-in), which closes it as `staff_resolved`. If staff earlier said "It is not sold" and Zoho still says Sold, recording the sale closes that overridden item as `replaced` and raises a fresh open one in the same transaction: Zoho wins. Nothing in payments or refunds changed.

**Reopen.** A sale reported by mistake is undone on the artwork's From Zoho record by an Administrator (`artwork_register.reopen_sold`, Administrator only, with a recent sign-in) with a reason. It is refused while Zoho still says Sold, because Zoho wins and the next pass would record it again: change the Status in Zoho first. The artwork returns to Not offered; nothing goes back on sale by itself. A sale made through LAX (lax.art, a Bid lot, a private sale) is never reopened here. While a gallery sale stands, the outbound Status write-back never writes `Sold` back over a different Status staff set in Zoho (`gallery_sale_owned_by_zoho`).

**Mode.** It runs inside the inbound artwork sync and needs both `ZOHO_ARTWORK_SYNC_MODE` and `ZOHO_ARTWORK_LISTING_MODE`: both `live` records sales; otherwise, when neither is `off`, it is a dry run that logs `zoho_gallery_sale_dry_run` and puts `gallerySale: { action: "would_record" }` on the Product's outcome, and changes nothing (the register, the items and lax.art all stay as they are, since LAX Shop only acts on a recorded sale). The nightly pass also sweeps originals Zoho shows as Sold that are held, withdrawn or on lax.art (`zoho_gallery_sale_sweep_finished`).

**Audit.** The register history gains `gallery_sale_recorded` (actor `zoho`) and `gallery_sale_reopened` (actor `staff:<id>`, with the reason); both publish `artwork_register.offer_changed`, so the listing and Status write-backs follow. Reopen and Dealt with also write LAX Admin audit rows. The scheduler's unpublish audit keeps the listing's previous `published_at`, so staff can restore it after a Reopen. Migration 0396 widens the event type and item resolution checks.

## Artwork state to Zoho Products (outbound)

LAX writes the state it owns back to the Zoho Product, and nothing else (Zoho owns the catalogue). The `Status` follows where the artwork is shown, the "Where it is" place LAX Admin draws, not the raw register state:

| "Where it is" place | Zoho `Status` |
|---------------------|---------------|
| Not offered, Draft on lax.art, On lax.art, Draft lot in LAX Bid | `Available` |
| In a LAX Bid sale | `In Auction` |
| In a private sale | `Reserved` |
| Sold | `Sold` |
| Withdrawn | `Withdrawn` |

Withdrawn shows for 30 days after the artwork leaves a place, then the place reads Not offered, so the `Status` returns to `Available` after the window (the nightly pass makes the change, as below). With no record of when it was withdrawn it stays `Withdrawn`.

The stock code is written to `Reference_Stock_Code` when LAX issues one. A stock code that came from Zoho is not sent back, and a stock code edited later in Zoho is a conflict for staff, never overwritten.

The register repository publishes `artwork_register.offer_changed` and `artwork_register.stock_code_assigned` in the same transaction as the change. The worker's `zoho_artwork_writeback` projector has its own cursor and its own `domain_event_delivery` consumer (`zoho_artwork_writeback`), independent of `ZOHO_CRM_SYNC_MODE` and its event allowlist. Failures retry with the shared backoff and then dead-letter in the same delivery ledger as the CRM sync.

Each delivery reads the register's current state (never the event's), then reads the Product from Zoho and skips the write when Zoho already holds the value, so a repeated or late event sends at most one update. After a Status write the register records the value as Zoho's own copy (`catalogue_status`, history event `zoho_writeback_recorded`), so the change coming back through the inbound sync is an `unchanged` outcome, not a Zoho edit. The Status is written only as described under Status ownership below. Updates are sent with `ZOHO_CRM_UPSERT_TRIGGER` (empty by default), so no Zoho workflow fires from LAX's own write.

### Status ownership

Zoho Products is the source of truth for inventory; LAX owns where an artwork is offered. The `Status` is therefore Zoho's to hold, and LAX writes it only when it can account for what Zoho shows. Every path (the register events and the nightly pass) goes through one compare-and-set, `ZohoStatusSync`, which decides with `decideStatusWrite` (`apps/worker/src/integrations/zoho/artwork/status/`).

Per artwork, under its advisory lock, LAX reads the register facts, then the Product's `Status` and `Modified_Time` from Zoho, and decides:

| Zoho `Status` now | LAX does |
|-------------------|----------|
| The value LAX wants | Nothing is sent; the register notes it as last written. |
| Nothing (blank) | Writes it. |
| `Available` | Writes it. |
| The value LAX last wrote (`artwork_register.catalogue_status_written`) | Writes it. |
| Anything else: a `Sold` or `Reserved` set by hand, `In Auction`/`Withdrawn` LAX did not write, or a value LAX does not know | Writes nothing and raises a conflict. |

A Product that Zoho changed after the facts were read (`Modified_Time` later than the read) is left for the next pass, so an older picture never goes over a newer one; an event retries, the nightly pass counts it as stale.

**How strong the compare-and-set is, and what is left.** Zoho's update API takes no precondition (no `If-Match`, no version on a Product), so the write cannot be made conditional on the Status. LAX therefore re-reads the Product (`Status` and `Modified_Time`) immediately before each write and sends only if both equal the read the decision was made on; if either differs, nothing is sent, the outcome is `stale` and the next run re-evaluates from fresh facts. A re-read that no longer finds the Product is a failure that will not pass (`product_not_found`).

**Check after the write.** Right after each write LAX reads the Product once more (`Status`, `Modified_Time`, `Modified_By`). Under the artwork's lock only LAX writes the Status, so a different value is someone else's change that landed with or after LAX's update. LAX never puts its own value back. The evidence that someone changed the Product is its `Modified_Time` moving past the re-read the write was sent on:

- **`Modified_Time` did not move** (or Zoho returned none): the read may have been answered from before LAX's update, so it proves nothing. No conflict is raised; LAX logs `zoho_status_write_unverified` (info, not an error) and the next event or nightly pass compares again.
- **`Modified_Time` moved and the value is one compare-and-set would not replace** (anything but blank or `Available`): LAX raises the same "Zoho Status" conflict as above, with both values, and the outcome is a `conflict` marked `changedDuringWrite` (counted under `conflicts`, not `written`).
  - `Modified_By` is a person: logged as `zoho_status_changed_during_write` with that Zoho user id (`cause: staff`).
  - `Modified_By` is the integration user LAX's token acts as: a Zoho workflow or blueprint reacted to LAX's update. It is still never reverted, but it is raised as **Zoho automation changed Status** (`cause: zoho_automation`, log `zoho_status_changed_by_automation`), and LAX Admin's history for the artwork reads "Zoho automation changed the Zoho Status" instead of "Zoho changed". The conflict itself is the same one in the From Zoho queue. The integration user's id comes from `GET /crm/v8/users?type=CurrentUser`, asked only the first time a check finds a change and then kept for the life of the worker (after a failure, asked again at most every 15 minutes). It needs the `ZohoCRM.users.READ` scope; without it (or while Zoho cannot answer) the lookup logs `zoho_integration_user_lookup_failed` and the change is treated as staff's.

What LAX sent is still recorded as last written, so a staff value equal to an older LAX write is not taken for LAX's own next time. If the check cannot read Zoho the write stands (`zoho_status_write_check_failed`) and the next pass compares again.

**Calls and API credits per Status write.** A live Status write costs **3 COQL reads + 1 update**: the read the decision is made on (batched, up to 50 Products per query), the re-read just before the write, the update, and the check after it (one Product each). The check after the write is the cost of this detection: one extra COQL read per live write, through the worker's one shared limiter (see **Pacing** under [Stock location](#stock-location-to-zoho-products-outbound)), and none in a dry run or when nothing is sent. The integration-user lookup adds at most one call per worker process. Day to day the volume is small, but at go-live the catch-up of a large artwork backlog (the first live nightly pass, or replayed deliveries) makes those 3 reads + 1 update for every artwork whose Status is written, so check the org's remaining API credits before switching `ZOHO_ARTWORK_WRITEBACK_MODE` to `live` on a large catalogue.

**Residual race:** a staff edit that Zoho applies after LAX's re-read but before LAX's update is overwritten and leaves no trace in `Status`, `Modified_Time` or `Modified_By` afterwards, so it cannot be detected this way; the window is one API round trip. Closing it needs Zoho conditional updates (or reading the record's field history). A dry run only reads once and sends nothing.

**Upgrade backfill.** Migration 0359 seeds `catalogue_status_written` from the latest `zoho_writeback_recorded` event for each register whose value still equals `catalogue_status`, so a Status LAX wrote before the column existed is not mistaken for a staff edit (an `In Auction` LAX wrote and later Sold, or a Withdrawn reaching day 30). Registers with no such event stay empty and are treated as not written by LAX.

A conflict appears in LAX Admin's From Zoho queue as the field "Zoho Status": "Zoho Status is X, LAX would set Y". It records both values and is not applied either way: closing it does not change Zoho. It is closed automatically once LAX and Zoho agree again (staff set the Status to `Available` or to what LAX wants, and the next pass writes or finds it in sync), and the nightly pass raises it again, or keeps the open one, while the difference stands. A conflict is raised once per pair of values.

`catalogue_status` (a Zoho-owned copy, updated by the inbound sync) is deliberately not the compare value: it follows whatever Zoho shows, including a Status staff set. `catalogue_status_written` holds only what LAX sent.

The **nightly pass** (03:00 London, after the listing check in the same job) walks every original and runs the same compare-and-set, so a missed event or a Withdrawn artwork's 30 days running out is repaired where compare-and-set allows and raised or kept as a conflict where it does not. It logs `zoho_status_reconcile_finished` with `checked`, `written` (or would-be, in a dry run), `unchanged`, `conflicts`, `stale` and `failed`, and `zoho_status_conflict` for each conflict. A failure of the Status pass is logged (`zoho_status_reconcile_failed`) and never hides the listing result. It is part of the nightly listing job, so it runs when `ZOHO_ARTWORK_LISTING_MODE` is not `off`, in the mode of `ZOHO_ARTWORK_WRITEBACK_MODE`: off does nothing, `dry_run` reads Zoho and writes and records nothing, `live` writes.

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_ARTWORK_WRITEBACK_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `dry_run` logs the update that would be sent (`zoho_artwork_writeback_dry_run`) and does not call Zoho (the nightly Status check below does read Zoho in a dry run, and writes nothing); its deliveries are recorded as skipped, so changes made during a dry run are not sent on switching to `live` until they are caught up (see [Switching a write-back to live](#switching-a-write-back-to-live-without-losing-changes)). `live` writes. Anything but `off` needs the three OAuth values (the worker refuses to start without them), because the dry run reads Zoho too. |

**Extra OAuth scope** for the refresh token: `ZohoCRM.modules.products.UPDATE`. Generate a new refresh token after adding it. A missing scope shows as failed deliveries. `ZohoCRM.users.READ` is optional: without it a Status change Zoho automation makes during a write is labelled as a staff edit (see Check after the write).

**Wrong-org guard.** With `ZOHO_ARTWORK_WRITEBACK_MODE=live` the worker refuses to start unless `ZOHO_CRM_EXPECTED_ORG_TYPE` (`sandbox` or `production`) is set, and at startup it reads the connected Zoho org and refuses to start if it does not match. This is the same check the CRM sync uses in canary and live; `dry_run` and `off` skip it.

Roll out: sandbox org with `dry_run`; then `live` in the sandbox, [catch up](#switching-a-write-back-to-live-without-losing-changes) and check one Product; then production.

## LAX listing on Zoho Products (outbound)

Staff who work from Zoho see where each original is today, without opening LAX. Four fields on Products, filled by LAX only:

| Field (API name) | Type | Holds |
|------------------|------|-------|
| `LAX_Listing` | picklist | The place, in the "Where it is" words LAX Admin uses, with the Bid sale phase and where a sale was made. |
| `LAX_Listing_Detail` | text (255) | Sale name, lot number and dates, or the private sale reference; empty when there is nothing to add. |
| `LAX_Listing_Link` | URL | The public lax.art page or Bid lot when buyers can see it; otherwise the LAX Admin or LAX Bid admin page. |
| `LAX_Listing_Updated` | date-time | When LAX last changed the listing. Also the ordering guard (below). |

Picklist values, in order: Not offered, Draft on lax.art, On lax.art, Draft lot in LAX Bid, In a LAX Bid sale — upcoming, In a LAX Bid sale — live now, In a LAX Bid sale — ended, In a private sale, Sold on lax.art, Sold in LAX Bid, Sold privately, Sold in the gallery, Sold, Withdrawn. The words come from `packages/artwork-register-contracts` (`lax-listing.ts`, built on `where-it-is.ts`), so LAX Admin and Zoho cannot drift. `Status` is unchanged and keeps its own write-back above.

**Setting up an org.** Create the four fields on Products with the labels LAX Listing, LAX Listing Detail, LAX Listing Link and LAX Listing Updated (Zoho derives the API names above), add the picklist values in the order above, and set field permissions to read-only for every profile except the one the integration user has (and Administrator, who can always change field settings). In the sandbox (`laxintegrationtest`) this is done; plain "Sold" still has to be added to the picklist there in Setup (Zoho stores it without the option, but views and filters only offer listed values). Add the fields to the Products layout.

**When it changes.** The worker's `zoho_artwork_listing` projector (own cursor and delivery consumer) refreshes the artworks an event can move: register moves (`artwork_register.offer_changed`), lax.art listings (`shop.artwork.created`, `shop.artwork.updated`), Bid lots (`lot.created`, `.published`, `.unpublished`, `.attached_to_sale`, `.detached_from_sale`, `.cancelled`, `.voided`, `.ended`, `.returned_to_inventory`) and sales (`sale.published`, `.unpublished`, `.ended`, `.cancelled`). `lot.activated` refreshes every lot of its sale, since the first lot on the block makes the whole sale live now. A nightly pass at 03:00 London (`zoho-listing-nightly-check` on the webhook queue) checks every original and corrects drift: a missed event, a Withdrawn artwork's 30 days running out, an edit in Zoho. A draft sale's start moved by staff is `sale.rescheduled`, which refreshes that sale's lots (a published sale is unpublished to be rescheduled, which `sale.unpublished` and `sale.published` already cover). A sale that starts on its own time raises no event, so every 15 minutes the `zoho-listing-sale-start` queue (its own queue, never the webhook queue) refreshes the lots of still-scheduled sales that started since the last fully successful run; that run's end is kept as a high-water mark in one row of `zoho_listing_sync_run` (`sale-start:high-water-mark`), so a delayed or failed run is made up for by the next, up to 24 hours back. It reads at most 10 pages of 200 artworks and logs `zoho_listing_sale_start_page_cap_reached` if it stops there; the nightly pass covers the rest. A failed run fails the job and does not move the mark. Sentry cron monitor: add `zoho-listing-sale-start` to `SENTRY_MONITOR_SLUGS` and create the monitor (15-minute schedule, about 5 minutes margin); without the entry the job runs unmonitored.

**How it writes.** The event only says what to look at; the listing is worked out from what LAX holds when it is handled. Per batch of 50: take a per-artwork advisory lock, read the facts (register, Bid lot and sale, private sale, and lax.art through LAX Shop's `POST /internal/inventory/art-listings/lookup`), read the four fields from Zoho with one COQL query, and send only the Products that differ in one `PUT /crm/v8/Products`. A repeat sends nothing. The lock means a later writer always reads newer facts; on top of that, a listing whose `LAX_Listing_Updated` is newer than the facts being sent is left alone. Zoho's other fields are never written. Rate limit, circuit breaker and retries are the shared gateway's; a delivery that keeps failing dead-letters as "Zoho artworks (LAX listing)" in Failed jobs. LAX Admin's From Zoho › Last check shows the latest nightly pass, the artworks not written (linked to their records) and how many writes are waiting in Failed jobs.

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_ARTWORK_LISTING_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `dry_run` reads LAX, lax.art and Zoho, logs each update it would send (`zoho_listing_dry_run`) and the nightly pass reports it in Last check; `live` writes. Independent of `ZOHO_ARTWORK_WRITEBACK_MODE`. |
| `ZOHO_FULFILMENT_MIRROR_MODE` | worker | `off` (default) \| `dry_run` \| `live`. Mirrors each print group made from an original to Zoho CRM (`Print_Products`, one `Edition_Ledgers` counter) and adds its `LAX-PRT` row to the artwork register. `dry_run` logs what it would write and writes nothing, in Zoho or the register; `live` writes and must pass the org check. Also mirrors each paid order's prints, framing and dispatch (see [Print orders to Zoho](#print-orders-to-zoho-outbound)). |
| `SHOP_API_INVENTORY_BASE_URL` | worker | LAX Shop's API, for the lax.art lookup. |
| `INVENTORY_MACHINE_CLIENT_ID`, `INVENTORY_MACHINE_CLIENT_SECRET` | worker | The inventory machine pair LAX Shop holds. |
| `LAX_ART_PUBLIC_URL`, `LAX_ADMIN_PUBLIC_URL` | worker | For the link. LAX Bid's comes from `WEB_ORIGIN`. |

Everything is required once the mode is not `off`; `live` also turns on the wrong-org guard. Roll out: sandbox `dry_run`, review Last check; sandbox `live`, [catch up](#switching-a-write-back-to-live-without-losing-changes), check a few Products; production `dry_run`; production `live` with the owner's go, then catch up.

## Stock location to Zoho Products (outbound)

Where an original physically is (LAX Admin › From Zoho › Locations, design: [stock location](../design/stock-location.md) section 5) is written to the Products text field **`LAX_Location`** (255 characters). LAX owns the value and Zoho shows it read-only. It holds the location's name as LAX Admin shows it, with "(retired)" after a retired location. It is empty when no location has been recorded. There is no sub-location: a location is one name from the list. It is separate from `LAX_Listing`, which is the sales place.

**When it changes.** The worker's `zoho_artwork_location` projector has its own cursor and delivery consumer. It handles `artwork_register.location_changed`, which is published for each move and, for every artwork at a location, when that location is renamed, retired or restored. The event only names the artwork. The value is read from LAX when the event is handled: the latest move, through the same store LAX Admin reads. Under the listing's per-artwork advisory lock, the worker reads `LAX_Location` with one COQL query and sends a `PUT /crm/v8/Products` only if Zoho shows something else, so a repeat or a retry sends nothing. Prints are not written. A delivery that keeps failing dead-letters as "Zoho artworks (stock location)" in Failed jobs.

**Nightly drift check.** At 03:30 London, `zoho-location-nightly-check` on the webhook queue checks every original the same way and corrects drift, such as a missed event or a value edited in Zoho. It logs `zoho_location_reconcile_finished` with `checked`, `changed` (or would-be, in a dry run), `unchanged`, `failed` and the first 20 failures. A failed page logs `zoho_location_reconcile_page_failed` and the pass carries on. When the mode is `off` the job is not scheduled, and a repeatable left over from earlier is removed. The result is in the worker log only: unlike the listing (`zoho_listing_sync_run`, shown as Last check), the location pass writes no row that LAX Admin's Sync health reads, and `ZOHO_ARTWORK_LOCATION_MODE` is not recorded in `zoho_sync_health` at start-up (that needs a new column, so a migration; left for a follow-up).

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_ARTWORK_LOCATION_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `off` never calls Zoho. `dry_run` reads LAX and Zoho and logs each update it would send (`zoho_location_dry_run`); its deliveries are recorded as skipped (`dry_run`), and the nightly check fixes them after the switch to `live`. `live` writes. Anything but `off` needs the three OAuth values. Independent of the other Zoho modes. |

**Guards.** `live` counts as writing to Zoho CRM, so it has the same wrong-org guard as the other writers: the worker refuses to start without `ZOHO_CRM_EXPECTED_ORG_TYPE`. Outside `APP_ENV=production` that value must be `sandbox`, and at start-up the connected org must match. **Pacing:** the worker builds one `ZohoCrmGatewayLimiter` per process (`zohoCrmGatewayLimiter` in `create-zoho-crm-gateway.ts`) and every Zoho CRM stack goes through it: CRM sync, artwork sync reads, write-back, Status (both the listing's pass and the standalone nightly), listing, location, fulfilment and QC. They share one 100 ms call spacing and one circuit breaker, so their combined rate against the org's API credits is capped together: each call reserves its slot before it waits, so calls from stacks running at the same time queue 100 ms apart rather than firing together, and a caller whose wait ends after the circuit opened gets the retryable 503 without calling Zoho. One success on any stack resets the shared failure count. Concurrent OAuth token refreshes in a process are single-flight: one request to Zoho, every caller gets its token, and the request gives up after 15 s so a hung refresh cannot stall every caller. An ops script (`backfill:crm-users`, `reconcile-crm-links`) is its own process with its own limiter, alongside the worker's. Product picture calls (`crm-product-image-gateway.ts`), the start-up org check and the integration-user lookup call Zoho outside the limiter, but share the single-flight token. **Grants:** `worker_app` has SELECT only on `artwork_location` and `artwork_location_move` (`WORKER_ARTWORK_LOCATION_READ_TABLES` in `packages/db/src/migrate-roles.ts`, covered by the worker role contract probe). No migration.

**Roll out.** The field already exists in the sandbox. In each org, set it read-only for every profile except the integration user's and add it to the Products layout. Then: sandbox `dry_run` and check the logs; sandbox `live` and check a few Products; production `dry_run`; production `live` with the owner's go.

## Print orders to Zoho (outbound)

Staff fulfil print orders in LAX Admin (pick, confirm, allocate the edition number, frame, dispatch). Each step is mirrored to Zoho CRM, one way, so Zoho is complete for reporting. It runs in the `zoho_fulfilment` consumer with the print group mirror and under the same `ZOHO_FULFILMENT_MIRROR_MODE`.

**Where print groups and SKUs come from today.** LAX makes them, from LAX Shop's prints listings; nothing reads them back from Zoho.

- *Print Product Groups.* The print group mirror (`print-group-mirror.ts`) creates or updates the group's `Print_Products` record, keyed on `Print_Group_ID` (the original's stock code as `LAX-PRT-…`), with `Total_Edition_Quantity`, `Collector_Allocation`, `Artist_Allocation`, `LAX_Allocation`, `Edition_Type` and `Linked_Original_Artwork` from the main-run listing (`plan-print-group.ts`). It creates or updates the group's one `Edition_Ledgers` record (`LAX_Mirror_Key`, `Linked_Print_Product_Group`, `Total_Edition`), and then issues the group's `LAX-PRT` row in the artwork register, keyed to the `Print_Products` record id. When one of those fields in Zoho differs from LAX, LAX overwrites it on the next event; fields LAX does not fill, and fields for which LAX has no value, are left as Zoho holds them.
- *Print SKUs.* The order mirror creates or updates `Print_SKUs` records (table below), keyed on `SKU`, which LAX builds from the listing and the print sold: `LAX-PRT-{group}-{SIZE}-{PAPER}-{FRAME}-{ALLOC}` (`buildPrintSku` in `@auction/artwork-register-contracts`). LAX Shop uses the same SKU.
- *The other way.* No LAX code reads `Print_Products`, `Edition_Ledgers` or `Print_SKUs` into LAX, except to find the record to update. The inbound artwork sync reads `Products` only, and the Status writeback leaves a print group alone (`print_group_not_a_product`).

**Owner decision pending: which system is master for prints.** An earlier version of this page said Zoho stays master for Print Product Groups and Print SKUs. The code above does not work that way: LAX creates both and keeps LAX's fields in line. Until the owner decides, this section describes the code as it is, and the behaviour is unchanged.

**When it runs.** On `shop.order.paid`, `shop.edition.sold`, `shop.edition.released`, `shop.print.pack_confirmed`, `shop.print.swapped`, `shop.framing.status_changed` (a framing task moving in LAX Admin), `shop.fulfilment.status_changed` and `shop.fulfilment.dispatched`. The order is taken from the payload's `orderId` (these events are raised on the order, a line or the fulfilment). Each event runs the same pass over the order as LAX and Zoho hold it then, and writes only what differs: a repeated, late or out-of-order event writes nothing stale, and a status is only ever moved forward, so a step staff took in Zoho is never pulled back. A status Zoho holds that LAX does not rank (one staff added to the picklist, such as a QC step) is left as it is and logged (`order mirror leaves a status it does not rank; add it to the rank table`), since LAX cannot tell whether moving it would be forward or back. Unpaid orders and prints of an original outside the register are skipped.

| Zoho module | One per | Matched on | LAX writes |
|-------------|---------|------------|------------|
| `Print_SKUs` | SKU | `SKU` | `SKU`, `Linked_Print_Product_Group` (the group's `Print_Products` record), `Size`, `Paper`, `Frame`, `Allocation_Bucket`, `Edition_Type`. Shared by every order of that SKU; never deleted on a refund. |
| `Edition_Ledgers` | print group | `LAX_Mirror_Key` (`group:{code}`, made by the group mirror) | `Assigned_To_Client`, `Assigned_To_Artist`, `Assigned_To_LAX`: the main run's prints sold on paid orders and not released, by holder; `Print_Sold`: their total. Proofs are not counted. A refund lowers them on the next event for the order. |
| `Print_Products` | print group | `Print_Group_ID` (made by the group mirror) | `Print_Sold`, the same total as the ledger. |
| `Framing_Jobs` | frame sold | the order-reference field, `{order reference}/{framing line id}` | `Linked_Print_SKU`, `Edition_Assigned` (`ED 07/25` for a numbered print, else the label at payment, such as `AP 2/3`), `Status`, and the framing details (option, frame, mount, glazing, hanging, lead time, due date) in the framing-spec field. |
| `Dispatch_Fulfilments` | order | the order-reference field, the order reference (`LAX-S-10482`) | `Status`, `Courier`, `Tracking_Number`, and in the prints field each print in the parcel: its SKU and edition (`LAX-PRT-…-A3-HAH-UNF-COL ED 07/25`; an open edition or proof by its label at payment, such as `AP 2/3`). Refunded prints drop off the list. |

The prints field is how Zoho knows which print, and which number, left in which parcel. It is written with the dispatch record, so from the first pick; an order kept in LAX storage has no dispatch record and so no list in Zoho. Courier, tracking number and the prints list are LAX's: one blanked or corrected in LAX Admin is cleared or corrected in Zoho too.

New records are written as a keyed upsert (`SKU`, the order-reference field), so two deliveries of one order (or two orders of a new SKU) running at once converge on one record instead of the second being refused as a duplicate. This needs those fields unique in Zoho (below).

The SKU's parts come from the prints listing: the size when the sheet text starts with `A1`–`A4`; the paper as its code or as one paper name (cotton, baryta, Hahnemühle, Munken); the frame from the frame sold with the print (black wood `FRB`, white wood `FRW`, natural oak `FRN`), else the listing's frame code, else `UNF`; the holder from the edition (`COL`, `ART`, `LAX`). Nothing is guessed: a part that does not map (or an edition the artist framed, described in words) fails the order with the line and the reason, after the order's other lines are written, and the delivery dead-letters for staff to correct the listing and replay. It is failed once, on `shop.order.paid` (or `shop.print.swapped`, for the swapped print): the order's later steps (pick, dispatch, refund) still mirror what they can, log the unmapped line as a warning (`order mirror: prints still not mirrored, already failed for staff`) and, when they write nothing, end as skipped `order_prints_not_mirrored`, so Failed jobs holds one entry per order rather than one per step. A refunded print's SKU is not worked out at all.

A frame is mirrored for its own sake: when its print has no SKU in Zoho (an original outside the register, or a part that does not map and fails the order for staff to fix), the job is still written, without `Linked_Print_SKU`. In `dry_run`, a job whose SKU does not exist yet is logged with `pendingFields: ["Linked_Print_SKU"]`, because the link needs the SKU's id.

Statuses. Framing task: queued → Queued, framing → In Progress, framed → Framed, completed → Complete, cancelled (or the print or frame refunded) → Not Required; a job is never created only to say Not Required. Zoho's QC steps (QC Pending, QC Passed, Rework Required) are left to staff in Zoho; LAX only moves past them (Complete, Not Required). Fulfilment: a print picked while in production → Pack Prep, awaiting dispatch or ready for collection → Ready, in transit → Dispatched, delivered or collected → Delivered; nothing is made before a print is picked, nor for LAX storage or a cancelled fulfilment. In Transit is left to staff in Zoho; LAX only moves past it (Delivered). A status nobody has set (`-None-`) is filled in. The return path is [Quality checks from Zoho](#quality-checks-from-zoho-inbound).

**Retries.** The group's `Print_Products` record and its ledger come from the print group mirror; while they are missing in `live` the delivery retries with backoff, then dead-letters as "Zoho fulfilment" in Failed jobs: the same delivery runner, backoff, dead-letter ledger and metrics as the print group mirror. Zoho refusing a record for its data is not retried. Rate limit, circuit breaker and token handling are the shared CRM gateway's. In `dry_run` nothing is written; each create or update it would make is logged (`order mirror would create, nothing written` / `order mirror would update, nothing written`) with the module, record id and exact fields.

**What is read.** Only the columns in `WORKER_SHOP_ORDER_FULFILMENT_READ_COLUMNS` (`packages/db/src/migrate-roles.ts`): the order's reference and paid date, its print and framing lines, the edition, the listing's run and sheet, the framing task's status and due date (not its assignee), and the fulfilment's status, courier and tracking number. No buyer name, address or contact is read or sent. The frame sold is read from the line's snapshot, which also holds its price (granted to the worker for invoicing already); only the frame is taken from it, and no price is sent.

**Calls per event.** Each event re-reads the order: per distinct original one register lookup, per group one `Print_Products` and one ledger read, per distinct SKU one read, and one dispatch read, each once per pass however many prints share them. Pending deliveries for the same order are not collapsed; at today's volume that is well within the shared COQL credit.

**Before `live`: fields the owners add.** `Framing_Jobs` and `Dispatch_Fulfilments` have no field that names the LAX order, `Framing_Jobs` has none for the framing details, and `Dispatch_Fulfilments` none for the prints in the parcel. In each org (sandbox first), an admin adds:

| Module | Field label | Type | API name (default) | Set by |
|--------|-------------|------|--------------------|--------|
| `Framing_Jobs` | LAX Order Ref | Single line, **unique**, read-only except for the integration user | `LAX_Order_Ref` | `ZOHO_FULFILMENT_ORDER_REF_FIELD` |
| `Framing_Jobs` | LAX Framing Spec | Single line (255) or multi-line | `LAX_Framing_Spec` | `ZOHO_FULFILMENT_FRAMING_SPEC_FIELD` |
| `Dispatch_Fulfilments` | LAX Order Ref | Single line, **unique**, read-only except for the integration user | `LAX_Order_Ref` | `ZOHO_FULFILMENT_ORDER_REF_FIELD` |
| `Dispatch_Fulfilments` | LAX Prints | Multi-line (small), read-only except for the integration user | `LAX_Prints` | `ZOHO_FULFILMENT_FRAMING_SPEC_FIELD` | worker | API name of the framing-details field above. Default `LAX_Framing_Spec`. |
| `ZOHO_FULFILMENT_DISPATCH_PRINTS_FIELD` |

Also mark `Print_SKUs.SKU` unique (the mirror finds SKUs by it and upserts on it; Zoho only matches an upsert on a unique field), check `Edition_Ledgers.LAX_Mirror_Key` exists (the print group mirror needs it too), check `Print_Sold` is a number field on `Edition_Ledgers` and `Print_Products`, and check the `Dispatch_Fulfilments.Status` and `Framing_Jobs.Status` picklists: values other than those named above are left alone by LAX, so add any that should rank to `DISPATCH_RANK` or `FRAMING_RANK` (`plan-order.ts`). If Zoho gives a field another API name, set the variable to it (letters, digits and `_` only; it is used in COQL). Until the field exists, `dry_run` fails the order's reads with Zoho's invalid-field error, which is the check that they are missing. LAX never creates Zoho fields.

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_FULFILMENT_ORDER_REF_FIELD` | worker | API name of the order-reference field above. Default `LAX_Order_Ref`. |
| `ZOHO_FULFILMENT_DISPATCH_PRINTS_FIELD` | worker | API name of the prints field above. Default `LAX_Prints`. |

Roll out: add the fields in the sandbox; sandbox `dry_run` and read the logged writes for a few orders, including a refunded and a framed one; sandbox `live` (the org check refuses anything but `ZOHO_CRM_EXPECTED_ORG_TYPE`); production fields, `dry_run`, then `live` with the owner's go.

## Switching a write-back to live without losing changes

A Zoho write-back in `dry_run` handles each event, logs what it would send and marks the delivery **skipped** (`dry_run`). A skipped delivery is never picked up again, so switching to `live` does not on its own send what changed during the dry run. This covers the artwork writeback (Status and stock code, `zoho_artwork_writeback`), the LAX listing (`zoho_artwork_listing`) and the fulfilment mirror (print groups and orders, `zoho_fulfilment`). The nightly listing and Status passes repair the listing and the Status (the Status only while `ZOHO_ARTWORK_LISTING_MODE` is not `off`). Nothing repairs the stock code, print groups or orders. LAX Admin's "Mirrored to Zoho" badge also keeps showing `dry_run` until those deliveries are handled live.

The catch-up puts back to pending exactly the deliveries one write-back skipped as `dry_run`. The live worker then sends them through its usual drain: one at a time, through the shared Zoho rate limit, circuit breaker, retries and dead-letter ledger. Each write-back reads LAX and Zoho when it handles an event and writes only what differs. An old event therefore sends the state that is true now, once, and running the catch-up again changes nothing.

```bash
pnpm --filter @auction/worker zoho:catch-up-after-live --consumer <zoho_artwork_writeback|zoho_artwork_listing|zoho_fulfilment> [--dry-run] [--limit N]
```

On test, run it with the **Zoho CRM maintenance (test)** workflow: action `catch-up-preview` or `catch-up`, plus the `consumer`. The workflow reads the modes from the GitHub `test` environment variables (`ZOHO_ARTWORK_WRITEBACK_MODE`, `ZOHO_ARTWORK_LISTING_MODE`, `ZOHO_FULFILMENT_MIRROR_MODE`), so set the chosen one to `live` there first.

Steps, one write-back at a time:

1. While still in `dry_run`, preview: `--dry-run` (workflow `catch-up-preview`). It prints `{"consumer", "mode", "apply": false, "dryRunSkipped", "requeued": 0, "remaining"}` and changes nothing. `dryRunSkipped` is how many deliveries will be sent.
2. Switch that write-back's mode variable to `live`. This turns on the wrong-org guard, so `ZOHO_CRM_EXPECTED_ORG_TYPE` must match. Deploy and wait for the worker to restart in `live`. It refuses to start if the org does not match.
3. Run the catch-up without `--dry-run` (workflow `catch-up`). It refuses unless the variable it reads says `live`. In `dry_run` the worker would skip the deliveries again. In `off` it would mark them `writeback_off`, which loses the `dry_run` mark the catch-up looks for. For a large backlog, use `--limit` (for example 500) and run it again until `remaining` is 0. The put-back deliveries queue ahead of newer events for that write-back.
4. Watch the queue drain: Sync health (writes waiting, dead-lettered) and Failed jobs. Spot-check a few records in Zoho. Run the preview again: `dryRunSkipped` should be 0.

Run the catch-up only after the worker is really `live`. If the worker is still in `dry_run`, it re-skips the deliveries as `dry_run`, and running again once it is live picks them up. Only deliveries skipped as `dry_run` are touched: other skips (already in sync, not paid, a raised Status conflict) and other consumers stay as they are. No mode is changed by the task.

## Mirror status per record (LAX Admin read)

LAX Admin can ask whether an order or an artwork reached Zoho (design: `docs/design/staff-gaps-delivery-zoho-alerts.md`, GAP-18). Nothing is stored for it: the state is worked out from `domain_event_delivery` on every read.

`GET /admin/v1/zoho-mirror/status?entity=order|artwork&id=…` (one record) and `GET /admin/v1/zoho-mirror/statuses?entity=…&ids=a,b,c` (up to 100, for a list column; the route counts the ids). `order` reads the `zoho_fulfilment` deliveries of the order-mirror events (`FULFILMENT_TRIGGER_KINDS`) whose payload `orderId` is the order, and needs `order.read`; `artwork` reads the `zoho_artwork_writeback` deliveries of the register entry's `artwork_register.offer_changed` and `artwork_register.stock_code_assigned` events, and the `zoho_artwork_listing` deliveries described below, and needs `artwork_register.read`.

**An artwork's state reads two of the consumers that write its Zoho Product:** the Status writeback (`zoho_artwork_writeback`: the Status and the stock code) and the LAX listing (`zoho_artwork_listing`: the listing fields). The stock location (`zoho_artwork_location`: `LAX_Location`) is not read; a failed location write shows in Failed jobs as "Zoho artworks (stock location)". The listing's deliveries read are those LAX Admin can tie to the artwork from the register alone, the same two links the worker follows: the listing's delivery of the register entry's `artwork_register.offer_changed`, and its deliveries of `shop.artwork.created` / `shop.artwork.updated` for the lax.art listing the artwork is offered through (`offer_ref_kind = shop_artwork`) or was drafted into (`lax_art_draft_created`) (`ARTWORK_LISTING_EVENT`). The listing's lot and sale events are fanned out to artworks through LAX Bid's lot table, which LAX Shop is not granted, so a failure on one of those still shows only in Failed jobs and the nightly Last check. The two consumers' deliveries are read as one list, oldest event first (on one event, the writeback's before the listing's), so the newest outcome of either decides and a listing that dead-lettered, is retrying or ran as a dry run shows as such. The listing is its own part of the record: a failed listing is put right only by a later good listing delivery, and a failed Status only by a later good Status write. The listing's "already in sync" and "Zoho shows a newer listing" skips count as mirrored; its reference (a count of Products written) is never shown as the Zoho record. `mode`, when the ledger does not prove one, is the configured mode of the consumer that made the delivery: `ZOHO_ARTWORK_LISTING_MODE` for a listing delivery, `ZOHO_ARTWORK_WRITEBACK_MODE` for a Status writeback one. So with the writeback `off` and the listing `live`, a dead-lettered listing reads failed in `live`, and an unfinished listing reads pending, not "Zoho mirroring is off". The badge's states and copy are unchanged.

The consumer names, the events and the skip reasons are written once, in `packages/types/src/zoho-mirror.ts`; the worker emits them from there and the read interprets them from there, so a renamed reason cannot silently read as "nothing to mirror".

| State | Derived from |
|-------|--------------|
| `failed` | a delivery dead-lettered, or was skipped `order_prints_not_mirrored` (order) or `status_conflict_raised` (artwork), and no later good delivery of **the same part of the record** has put it right. It wins over anything newer. For an order, a print failure is put right only by a later good `shop.order.paid` or `shop.print.swapped` delivery (`ORDER_EVENTS_THAT_SET_PRINTS`), since the pick and dispatch steps succeed without reporting prints; any other order failure by any later good delivery. For an artwork, a failed Status is put right only by a later good Status write, a failed stock code by a later good stock code write, and a failed listing by a later good listing delivery. |
| `mirrored` | otherwise, the newest delivery succeeded, or was skipped because Zoho already held the data (`order_already_in_sync`, `status_already_in_sync`, `stock_code_already_in_sync`, `listing_already_in_sync`, `newer_listing_in_zoho`) |
| `pending` | the newest delivery is `pending`, `processing` or `retryable` |
| `dry_run` | the newest delivery was skipped as `dry_run` |
| `not_applicable` | `mirroring_off` (the mirror is configured off and the record is not already mirrored, or skipped `writeback_off`); `not_paid` (an order with nothing sent that is not paid, or skipped `order_not_paid`); `not_in_register` (skipped `register_entry_missing`); `not_sent_yet` (a paid order or an artwork with nothing sent); `nothing_to_mirror` (any other skip reason) |

`mode` is what the ledger proves (a success or an "already in sync" skip is recorded only live, a dry-run skip only in a dry run, an off skip only when off); otherwise it is the mode shop-api is configured with, from `ZOHO_FULFILMENT_MIRROR_MODE` (orders), `ZOHO_ARTWORK_WRITEBACK_MODE` (an artwork's Status writeback) and `ZOHO_ARTWORK_LISTING_MODE` (an artwork's LAX listing) set on **shop-api** to the worker's values. They are optional there: unset, `mode` is `null` for a failed or pending record, and "Zoho mirroring is off" is shown only when the ledger says so. `zoho_sync_health` does not hold these modes, and the read stores nothing.

Whether an order is paid (`shop_order.paid_at`, as the order mirror decides it) is read only for orders with no delivery, in one query by primary key for the batch. The error text is the ledger's already redacted `last_error`; no buyer data is read. The badge and details copy (Z3) is in `packages/shop-contracts/src/zoho-mirror-copy.ts`.

Query plan: the order read is held to the order-mirror event types, so Postgres reaches `domain_events` through `domain_events_event_type_idx` instead of scanning every event; the artwork read uses `domain_events_aggregate_idx` and `domain_event_delivery_consumer_event_id_unique`. The plans are in PR #1516.

## Quality checks from Zoho (inbound)

This follows the approved Zoho CRM decisions of 11-04: leads are not auto-converted; fulfilment is owned in LAX Admin and mirrored to Zoho; printing and framing jobs stay in Zoho; and Zoho's **QC Passed** moves the LAX line to **ready to pack**. (ZO1-ZO24 cover offering artworks from Zoho and do not apply here.) In code and in LAX Admin the step is called "Quality check passed", the production task status `qc_passed`; that is the approved "ready to pack" (LAX has no separate ready-to-pack status).

Printing and framing jobs stay owned in Zoho. When a Zoho job reaches `QC Passed`, LAX moves the print on the order line to **Quality check passed** (the production task status LAX Admin shows before packing); the order mirror then shows it in Zoho as it already does. LAX never writes the job's QC status.

1. **Signed notice.** A Zoho workflow rule posts `{"module":"Framing_Jobs","recordId":"…","modifiedTime":"…"}` to `POST /webhooks/zoho/qc` with the shared secret in `X-LAX-Webhook-Secret` (`ZOHO_QC_WEBHOOK_SECRET`, api, 32+ characters; unset, the route answers `503` and stores nothing). The secret is a static header, not a signature: a captured request can be replayed, which only costs one Zoho read because the worker acts on the record, not the notice. A `modifiedTime` more than five minutes ahead of the API's clock is refused with `400`, and the route is rate limited per client address like the other inbound webhooks. The API stores it in `webhook_event` (source `zoho_qc`, idempotent on module, record id and modified time) and queues it, exactly as the artwork notice.
2. **The worker reads the record**, not the notice, so the state acted on is always Zoho's latest. An older notice processed late sees the newer status and cannot undo it; a record older than the notice (Zoho lag) is retried; anything other than `QC Passed` does nothing.
3. **The record names the line.** The job's order-reference field (`ZOHO_FULFILMENT_ORDER_REF_FIELD`, the same one the order mirror writes) holds `{order reference}/{line id}`: for a framing job the framing line, which resolves to the print it is sold with. The reference must match the line's order. Nothing is guessed.
4. **LAX Shop makes the change** (`POST /internal/inventory/zoho-qc-passed`, inventory machine credential), through the same production task rules as LAX Admin: a task awaiting its check (or printing, which passes through it) becomes quality check passed, with an audit row by `system:zoho-qc` that carries the Zoho module and record id; one already there or further on is left alone, so a repeat changes nothing. A print whose frame is still open in LAX Admin is not passed.

A cancelled, expired, failed-payment or refunded order's print is not moved (`not_ready`, so it reaches staff as below); a print whose task is already dispatched (`completed`) is accepted as already done and left alone.

**One way.** LAX never moves back: if Zoho later goes QC Passed → Rework Required, the LAX task stays at quality check passed. This is deliberate; staff handle rework in Zoho and, if needed, in LAX Admin.

A record Zoho no longer has, with no usable reference, matching no line or order, with no production task, a task that cannot pass yet (queued, failed, cancelled) or an open frame fails the notice: it is retried, then shows in Failed jobs as "Zoho quality checks" for staff. Replaying it after the cause is put right is safe.

**No loop.** The path only reads Zoho. The order mirror's writes carry no workflow trigger (`ZOHO_CRM_UPSERT_TRIGGER`) and never write `QC Passed`, so LAX's own mirror write cannot raise a notice that moves anything.

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_QC_READY_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `off` calls neither Zoho nor LAX Shop and does not consume notices: they stay stored and unprocessed (the worker's drain skips them); `dry_run` reads Zoho and logs what it would move; `live` moves the print. Not `off` needs the Zoho OAuth values, `SHOP_API_INVENTORY_BASE_URL`, the inventory machine pair and `WEBHOOK_EVENTS_PROCESS=true`. |
| `ZOHO_QC_WEBHOOK_SECRET` | api | Shared secret for the route above. |

**Turning it on loses no notices.** Notices received while the mode is `off` wait in `webhook_event` and are processed, oldest first, once the mode is `dry_run` or `live` and the worker restarts. `dry_run` only logs, and it marks them processed, so to move prints from notices that arrived while off, switch from `off` straight to `live`; otherwise re-send from Zoho. Each notice is read against Zoho's current record, so old ones are safe.

**Before turning it on** the owners add the order-reference field to `Framing_Jobs` (see Print orders to Zoho) and a workflow rule on `Framing_Jobs` (edited, `Status` changed) with a webhook to `/webhooks/zoho/qc`. Until then it stays `off`. Only `Framing_Jobs` is a quality check module today; a printing-job module joins by adding it to `ZOHO_QC_MODULES` once it exists in Zoho and carries the same reference.

## Sync health (LAX Admin)

LAX Admin's From Zoho › Sync health tab (read with `artwork_register.read`, which `artwork_register.review` includes) shows whether Zoho and LAX are keeping up: the last inbound nightly run (Products seen, changed, left out; test artists are not counted as left out), the last nightly listing and Status check (drift found), the writes waiting to go to Zoho Products (depth, oldest waiting, dead-lettered with a link to Failed jobs in LAX Bid admin), the token (last good refresh, expiry, failed refreshes in a row) and three read-only drift lists, 25 per page: artworks whose Zoho Product is deleted, Zoho Products (originals) with no register entry, and originals whose Zoho Status is not the one their place calls for (`ZOHO_STATUS_FOR_OFFER` in `@auction/artwork-register-contracts`, the same table the writeback uses). With the sync off, or before the worker has reported, the tab says so.

The worker keeps one row in `zoho_sync_health` (migration 0366): the sync modes it started with, and the token refresh record. A failed refresh is recorded by code only (never Zoho's response). The second failure in a row logs `{ alert: "zoho_token_refresh_failing" }` at error level and the tab shows a danger notice; the next good refresh clears both. Anything older than a day without a good refresh while a sync is on shows as a warning.

Sentry cron monitors: add `zoho-artwork-nightly-check` (inbound, 02:30 London) and `zoho-listing-nightly-check` (listing and Status, 03:00 London) to `SENTRY_MONITOR_SLUGS` and create the monitors (daily schedule). A job checks in only when its slug is configured and `SENTRY_DSN_WORKER` is set; otherwise it runs unmonitored.

## Campaigns suppression (inbound)

LAX copies Zoho Campaigns unsubscribes and hard bounces into its own suppression list, so mail sent from LAX respects a choice made in Campaigns. Read-only towards Zoho.

**What it records.** An unsubscribe becomes `unsubscribed_marketing`: it stops alert mail (`shop-edition-available-notify`, `shop-release-alert`, `alert-digest`) and nothing else. An alert confirmation (`alert-confirm`) is never stopped by it, because it answers a request the person has just made. A hard bounce becomes `hard_bounce`. Soft or unlabelled bounces are skipped. An entry is only ever widened by the sync, never narrowed.

**Consent and lifts.** A Campaigns opt-out must not block alerts the person later asks for, and a lift must last. A lift is recorded per address hash in `zoho_campaigns_optout_lift` (`lifted_at`), kept apart from `email_suppression` because a lift can happen when there is no row yet. The sync skips a marketing opt-out dated at or before `lifted_at`; one with no readable time counts as old when a lift exists; a newer unsubscribe applies again. Bounces and complaints are never held back by a lift and never lifted. Only an entry with `source = 'zoho_campaigns'` and `reason = 'unsubscribed_marketing'` is ever removed.

One SQL function, `lift_zoho_campaigns_opt_out()` (migration 0323, `SECURITY DEFINER`), is the only writer of a lift: it records `lifted_at` (latest wins) and deletes only that kind of entry, under a per-address advisory lock shared with the sync. No role has `DELETE` on `email_suppression` for this; `api_app` and `worker_app` may `EXECUTE` the function, and the worker reads the lift table. A lift happens in the one "subscription became confirmed" step, on every path:

| Path | How it lifts |
|------|--------------|
| Bid confirm link; a signed-in Bid account turning alerts on (`PreferencesService`, `saveConfirmedForAccount`) | Bid API calls the function directly. |
| LAX Shop and lax.art confirm link; a signed-in account turning alerts on; a lax.art follow | `shop-api` writes the domain event `alert.subscription.confirmed` (address hash only). The worker projector `zoho_campaigns_opt_out_lift` calls the function. `shop_app` gets no new grant. |
| Staff, from the person's email panel | Same function, via `liftMarketingOptOut`. |
| Newsletter sign-up through LAX | The `zoho-campaigns-sync` job lifts once the address is pushed to the list. |
| Re-subscribe in Campaigns | The sync also reads the subscribed list (`status=active`, `subscribed_time`); a contact whose Campaigns opt-out is older than their subscribe time is lifted, dated at the subscribe time. A row with no subscribe time is skipped. Live mode only. |

A lift made in the same minute a person confirms is judged by the engine's clock, not Zoho's; a skew of seconds can at worst let an opt-out dated just after the lift through, which then stands as a new unsubscribe.

**Schedule and load.** Campaigns has no "changed since" filter, so every pass reads the unsubscribed, bounced and subscribed lists whole (200 per page, up to 500 pages each). It runs **daily at 03:15 London**, not hourly, to stay within Zoho's API allowance. Every row is applied on every pass, however old, because the upsert is idempotent: an unsubscribe that appears late in the list is still recorded. The watermark (`zoho_campaigns_suppression_state`) only feeds the summary's `due` count. No hourly need is documented; if one arises, add a page budget first and record the need here.

**Errors.** A non-2xx answer, a body whose `status` is not `success`, or a 200 with no `list_of_details` array stops the pass and lands in Failed jobs. Nothing is read as "an empty list".

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `dry_run` reads Zoho and logs what it would record; `live` records it. |
| `ZOHO_CAMPAIGNS_LIST_KEY` | worker | The Campaigns list to read. Required once the mode is not `off`, with the Zoho OAuth trio. |

**Confirm in dry run before going live.** The adapter was written from the documented shape, not against the Campaigns sandbox. Run `dry_run` first and check each of these against real answers:

1. **Host.** `ZOHO_API_HOST` (EU: `https://www.zohoapis.eu`) serves `/api/v1.1/getlistsubscribers`. Campaigns has historically used its own host (for example `campaigns.zoho.eu`), so confirm which one answers with this OAuth token.
2. **Response shape.** `200 { "status": "success", "list_of_details": [ ... ] }`; the row fields (`contact_email`, `unsubscribed_time` / `bounced_time` / `subscribed_time`, `bounce_type`); that `status=active` returns subscribed contacts; the 1-based `fromindex` and `range` paging; and what an empty page or empty list returns. If a valid empty list omits `list_of_details`, the pass will fail and the adapter must be changed before live.
3. **OAuth scope.** The refresh token needs **`ZohoCampaigns.contact.READ`** in addition to the CRM scopes above. Without it the call fails with an auth error.

Roll out: sandbox `dry_run`, read the logged summary (`read`, `due`, `skipped`, `heldByLift`, `resubscribed`); sandbox `live`; production `dry_run`; production `live` with the owner's go.

## Ops scripts

```bash
pnpm --filter @auction/worker backfill:crm-users [--dry-run]
pnpm --filter @auction/worker reconcile:crm-links
pnpm --filter @auction/worker replay:crm-skipped
pnpm --filter @auction/worker zoho:catch-up-after-live --consumer <consumer> [--dry-run] [--limit N]
```

See [async-delivery-phase-two.md](../runbooks/async-delivery-phase-two.md) for rollout and dead-letter handling.
