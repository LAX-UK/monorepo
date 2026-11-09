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
| `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED` | `false` | `shop.artwork.created` → Products |
| `ZOHO_CRM_LEAD_STATUS_NEW` | `New (Unassigned)` | Lead Status a new website lead starts with; must exist in the org's Lead Status picklist (the sandbox has `New`) |

After changing vars, re-run **Terraform test up** (with image contracts) or **Terraform apply test** so the worker spec updates.

**Zoho CRM maintenance (test)** workflow (`zoho-crm-maintenance-test.yml`): manual `backfill-dry-run`, `backfill`, `replay-skipped`, or read-only `delivery-status` (counts and recent retry/dead-letter rows from `domain_event_delivery`; no event payloads). Backfill exits non-zero when any Zoho row returns an error. CI builds `@auction/db` and `@auction/persistence` only (tsx runs worker scripts); do not set job-level `NODE_ENV=production` before `pnpm install` or TypeScript builds lose `@types/node`.

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
| `ZOHO_CRM_LEAD_STATUS_NEW` | Lead Status written when the platform creates a lead (default `New (Unassigned)`) |
| `ZOHO_CRM_CURSOR_BATCH_SIZE` | Domain events ingested into the delivery ledger per projector tick (default `100`) |
| `ZOHO_CRM_TICK_TIME_BUDGET_MS` | Max ms per projector tick spent claiming and running Zoho deliveries (one claim at a time) |

Production worker keeps `ZOHO_CRM_SYNC_MODE=off` until [Phase 0 runbook](../runbooks/zoho-crm-phase0-prerequisites.md) exit criteria pass.

**Shop gaps:** refund/fulfilment domain events are not emitted yet; catalogue sync requires the env var above. A Shop original enquiry creates a Lead and needs no stage variable.

## Architecture

- Domain events → `zoho` projector → `CrmSyncService` (dispatcher) → person/deal/lifecycle handlers → `CrmGateway` (Zoho adapter + rate limiter, wired in the worker container).
- Idempotency: Zoho external fields (`LAX_Subject_ID`, `LAX_Deal_Key`) + `crm_record_link` (including tombstones and persisted deletion-request flags).
- Deliveries use `domain_event_delivery` with explicit **`skipped`** status (dry run, disabled type, policy) and `replay:crm-skipped` script for skipped rows.
- Metrics: `auction_zoho_crm_api_credits_remaining` (from `X-API-CREDITS-REMAINING` when present); `auction_delivery_oldest_pending_age_seconds{consumer="zoho"}`; `auction_delivery_dead_letter_total{consumer="zoho"}`.

## Event mapping (catalog consumers)

- Identity: `user.registered`, `user.email_verified`, `user.profile_updated`, `user.deletion_requested`, `user.deletion_cancelled`, `user.identity_merged`, `user.identity_deleted`  
  **Lifecycle** (`deletion_*`, `identity_merged`, `identity_deleted`) is always delivered when any person event type is allowlisted, even if omitted from `ZOHO_CRM_ENABLED_EVENT_TYPES`.
- Enquiries: `marketing_enquiry.received` (private sale and contact enquiries). Off unless the event is in `ZOHO_CRM_ENABLED_EVENT_TYPES`; see the runbook section "Enquiry leads".
- Bid: `bid.first_for_user`, `bid.lot_won`, `payment.captured`, `payment.refunded`
- Shop: `shop.order.paid`, optional `shop.artwork.created` (catalogue sync flag), `shop.artwork.interest_registered` (enquiry). Deal patches require an existing person link — run `backfill:crm-users` for shop-only buyers before enabling shop CRM events.

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

1. **Signed notice.** A Zoho workflow rule posts to `POST /webhooks/zoho/artworks` when a Product is created or edited. The API checks the shared secret (`X-LAX-Webhook-Secret`, compared in constant time), stores the notice in `webhook_event` (source `zoho_artwork`, idempotent on Product id and modified time), queues it on the `webhook-events` queue and answers `202`. The worker then reads that Product from Zoho (COQL) and processes it.
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

## Artwork state to Zoho Products (outbound)

LAX writes the state it owns back to the Zoho Product, and nothing else (Zoho owns the catalogue):

| LAX offer state | Zoho `Status` |
|-----------------|---------------|
| `held`, `lax_art` | `Available` |
| `bid_sale` | `In Auction` |
| `private_sale` | `Reserved` |
| `sold` | `Sold` |
| `withdrawn` | `Withdrawn` |

The stock code is written to `Reference_Stock_Code` when LAX issues one. A stock code that came from Zoho is not sent back, and a stock code edited later in Zoho is a conflict for staff, never overwritten.

The register repository publishes `artwork_register.offer_changed` and `artwork_register.stock_code_assigned` in the same transaction as the change. The worker's `zoho_artwork_writeback` projector has its own cursor and its own `domain_event_delivery` consumer (`zoho_artwork_writeback`), independent of `ZOHO_CRM_SYNC_MODE` and its event allowlist. Failures retry with the shared backoff and then dead-letter in the same delivery ledger as the CRM sync.

Each delivery reads the register's current state (never the event's), then reads the Product from Zoho and skips the write when Zoho already holds the value, so a repeated or late event sends at most one update. After a Status write the register records the value as Zoho's own copy (`catalogue_status`, history event `zoho_writeback_recorded`), so the change coming back through the inbound sync is an `unchanged` outcome, not a Zoho edit. Updates are sent with `ZOHO_CRM_UPSERT_TRIGGER` (empty by default), so no Zoho workflow fires from LAX's own write.

| Variable | App | Purpose |
|----------|-----|---------|
| `ZOHO_ARTWORK_WRITEBACK_MODE` | worker | `off` (default) \| `dry_run` \| `live`. `dry_run` logs the update that would be sent (`zoho_artwork_writeback_dry_run`) and does not call Zoho; its deliveries are recorded as skipped, so changes made during a dry run are not sent on switching to `live` (replay them from the delivery ledger or re-save the artwork). `live` writes and needs the three OAuth values. |

**Extra OAuth scope** for the refresh token: `ZohoCRM.modules.products.UPDATE`. Generate a new refresh token after adding it. A missing scope shows as failed deliveries.

**Wrong-org guard.** With `ZOHO_ARTWORK_WRITEBACK_MODE=live` the worker refuses to start unless `ZOHO_CRM_EXPECTED_ORG_TYPE` (`sandbox` or `production`) is set, and at startup it reads the connected Zoho org and refuses to start if it does not match. This is the same check the CRM sync uses in canary and live; `dry_run` and `off` skip it.

Roll out: sandbox org with `dry_run`; then `live` in the sandbox and check one Product; then production.

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
| `ZOHO_FULFILMENT_MIRROR_MODE` | worker | `off` (default) \| `dry_run` \| `live`. Mirrors each print group made from an original to Zoho CRM (`Print_Products`, one `Edition_Ledgers` counter) and adds its `LAX-PRT` row to the artwork register. `dry_run` logs what it would write and writes nothing, in Zoho or the register; `live` writes and must pass the org check. Order events are heard and skipped until the order mirror lands. |
| `SHOP_API_INVENTORY_BASE_URL` | worker | LAX Shop's API, for the lax.art lookup. |
| `INVENTORY_MACHINE_CLIENT_ID`, `INVENTORY_MACHINE_CLIENT_SECRET` | worker | The inventory machine pair LAX Shop holds. |
| `LAX_ART_PUBLIC_URL`, `LAX_ADMIN_PUBLIC_URL` | worker | For the link. LAX Bid's comes from `WEB_ORIGIN`. |

Everything is required once the mode is not `off`; `live` also turns on the wrong-org guard. Roll out: sandbox `dry_run`, review Last check; sandbox `live`, check a few Products; production `dry_run`; production `live` with the owner's go.

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
```

See [async-delivery-phase-two.md](../runbooks/async-delivery-phase-two.md) for rollout and dead-letter handling.
