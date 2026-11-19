# Zoho Books go-live and Xero removal

Status: **plan, docs only** (2026-11-19). Nothing in this document is built by the PR that adds it.

This replaces the cutover parts of the approved Zoho Books plan (plan v2) after the owner's
decisions of 2026-11-19. It says where every plan PR stands on `main`, what is left and what each
remaining item waits for, how Shop/Art reaches Books from day one, everything Xero touches and the
order to remove it, the proof on test that must pass first, and the PRs to get there.

## Owner decisions this follows (2026-11-19)

| # | Decision | What it changes in plan v2 |
| --- | --- | --- |
| D1 | **Zoho Books is a fresh start.** No Xero history is moved, there is no migration, no cutover window and no rollback to Xero. | F18 (Shop history import into Books, Xero as read-only archive, unpaid Xero invoices settled in Xero until a fixed date) and the F19 cutover window and "Rolling back" are withdrawn. `books:import-shop-history` and the cutover half of `docs/runbooks/zoho-books-cutover.md` are no longer needed. |
| D2 | **At launch Books is the only accounting system** for Bid (London Auction Xchange Ltd) and for Shop/Art (London Art Exchange Ltd). | The two products go live on Books together; there is no product on Xero and another on Books. |
| D3 | **Xero is removed completely from the code** once Books is proven end to end on test. | F20 ("no new Xero work") becomes "delete Xero". `xero_mode`, `XERO_API_WRITES_DISABLED` and every Xero writer, route, table, job, page and variable go (section 4). |
| D4 | **Test posts to two separate free Books test organisations**, one per company. They are still to be created; their organisation ids are pending. | `BOOKS_ORGANISATIONS` (`packages/accounting-zoho-books/src/adapter/organisations.ts`) gets one `test_org` binding per product. The live organisations are bound later, by the go-live PR. |
| D5 | **Buyer default rules.** A sent invoice is always cancelled by a credit note (void only if it was never sent); a payment that arrives later is put on a new invoice; bank-transfer refunds go only to the source account, with two-person approval. | `BID_DEFAULT_ACCOUNTING_TREATMENT` is decided (`credit_note`): this is an owner decision, not an accountant one, so it is buildable now. Audit and pure guards are in open PR #1576 (`docs/design/buyer-default-and-refunds.md` on branch `feat/buyer-default-refund-rules`). |

### Accountant questions still open

Referred to below by their code. Each is parked in code today: the document is built and held in
Finance › Accounting "Needs a person", never sent and never guessed.

| Code | Question | Where it is parked today |
| --- | --- | --- |
| Q-VATREG | Are London Auction Xchange Ltd and London Art Exchange Ltd VAT registered (and from when)? | `vatRegistered` in each organisation's settings has no default (`adapter/org-config.ts`); a line with VAT on an unregistered organisation is refused (`zoho_books_mapping_vat_on_unregistered_entity`). |
| Q-PREMIUM | VAT on the buyer's premium; margin scheme vs standard; artist's resale right (ARR) treatment. | `BID_LINE_BOOKINGS` and `BID_LINES_AWAITING_ACCOUNTANT` (`packages/accounting-domain/src/projection/bid.ts:50-64`): `vat_on_hammer`, `import_vat`, `artists_resale_right`, `delivery` refuse with `line_awaiting_accountant`. Hammer and premium go as `margin_scheme` until answered. |
| Q-COMMISSION | VAT on seller commission; is commission netted inside the sale or invoiced to the seller? | `BID_SELLER_PAYOUT_BOOKING = null` (`projection/payouts.ts:36`), park reason `seller_payout_treatment`. |
| Q-AGENT | Principal or agent for Shop artists (and private sales). | `SHOP_ARTIST_PAYOUT_BOOKING = null` (`projection/payouts.ts:39`), park reason `artist_payout_treatment`; private-sale payout lines park as `payout_lines_unmapped`. |
| Q-ZERO | Zero-rating (or outside scope) for delivery and goods outside the UK; VAT on courier delivery. | `SHOP_OUTSIDE_UK_DELIVERY_BOOKING = null` (`projection/shop.ts:72`, park `vat_on_outside_uk_delivery`); `DELIVERY_BOOKING = null` (`projection/bid-payments.ts:97`, park `vat_on_delivery`). |
| Q-STORAGE | VAT on storage charges and late-payment interest. | No booking exists for either line kind; they must not reach an invoice line until answered. |
| Q-PRIVATE | VAT on private sales. | Private-sale payout lines park (`payout_lines_unmapped`). |
| Q-YEAREND | Financial year end of each company. | Books organisation setting; no code depends on it except the locked-period refusal (`*_period_locked`). |
| Q-ROUNDING | Does Books round a tax-inclusive line's VAT half-up, per line? | Assumed by `vatInsideGross` / `creditLines` (`packages/accounting-domain/src/document.ts`) and checked by the adapter (`zoho_books_mapping_vat_differs_from_books`). Fails safe, but must be confirmed on the test organisation and by the accountant. |
| Q-OPENING | Opening balances in each new organisation (bank, Stripe clearing, debtors, creditors, seller money held). | Not modelled in LAX; entered by the accountant in Books. The Stripe sync restates nothing at a mode switch (#1376 follow-up). |
| Q-QUARTER | VAT quarter dates (the go-live date should be the first day of a VAT quarter or of the registration). | Runbook precondition only. |
| Q-ACCOUNTS | The chart of accounts, tax ids and accounts per line role, Stripe clearing, Stripe fees and bank account ids for each organisation. | `ZOHO_BOOKS_ORG_CONFIG` (`parseOrgConfigs`). Without the Stripe accounts, fees and payouts are refused (`zoho_books_mapping_stripe_accounts_missing`). |

## 1. Plan v2 PRs against `main`

Plan v2 is the approved Zoho Books plan. Its text is not kept in the repository; the PR numbers
below are taken from the merged PRs, which name their plan step ("PR 2 of the approved Zoho Books
plan", "plan v2, PR 12", …). Steps 16 and 17 are the two "later changes" the runbook and PRs refer
to: wiring the test and live organisations (16), and switching over (17). `main` is at #1575.

| Plan step | PR | What it delivered | Status on `main` | What is missing (file refs) |
| --- | --- | --- | --- | --- |
| 0. Xero safety | #1299 | Xero tokens sealed at rest (`XERO_TOKEN_DEK_KEY`, migration 0367); buyer-data reports removed. | **Done.** Becomes dead code under D3. | Removed with Xero (section 4). |
| 1. Accounting domain | #1300 | `packages/accounting-domain`: documents, ports, life cycle, money rules, source switch. | **Done.** | `source-switch.ts` still models Xero as a provider: simplified by the removal PRs. |
| 2. Storage and switch | #1306 | `accounting_document`, history, `accounting_source_setting` (migration 0368). | **Done.** | `xero_mode`, `provider IN ('xero','books')` and `accounting_source_setting_one_live_ck` go with Xero. |
| 3. Books HTTP client | #1311, #1559, #1572 (F17) | Client, sealed per-organisation tokens (`zoho_books_connection`, 0369), EU-only hosts, limits shared through Redis (`createZohoBooksHttpClient`, `packages/finance-runtime/src/books/create-zoho-books-client.ts`). | **Partly.** | No `ZohoTokenStore` over `zoho_books_connection` (README "Not here yet"); no way to connect an organisation (OAuth grant / code exchange); the factory is not called by any runtime. |
| 4. Adapter, fake, contract suite | #1321, #1340 | Ports per kind, mappers, duplicate guard, lookup, read-back, write gate, destination binding. | **Partly.** | Real PDF fetch answers `zoho_books_pdf_not_built` (`adapter/pdf.ts`); field names, duplicate-value code, period-lock code 4151, `/vendorpayments`, bank transaction custom field and "apply credits" shape are unconfirmed against real Books (README, "Still to confirm"). |
| 5. Projector and sender | #1335 | `accounting` consumer, projector, sender, lease/retry/escalation. | **Done (dry run).** | The sender only has `byMode.dry_run` (`create-books-accounting-adapters.ts:50`). |
| 6. Finance › Accounting, alerts | #1347, #1350 | `/admin/finance/accounting`, Failed jobs source, alerts, cron monitors. | **Done.** | — |
| 7. Bid invoices | #1356 | `invoice.raised` → Books invoice, LAX's stored PDF copy (0381), "Your invoice" email (live only). | **Done (rehearsal).** | Premium/ARR/import VAT lines refused until Q-PREMIUM; PDF copy needs the real fetch (step 4). |
| 8. Payments | #1359 | Card, Pay several, bank transfer payments into Stripe clearing; ordering; Release. | **Done (rehearsal).** | Courier delivery invoice parked until Q-ZERO (`DELIVERY_BOOKING`). |
| 9. Bid refunds | #1375, #1431 | Credit notes for refunds, delivery refunds, reversals, buyer default. | **Partly.** | Buyer default parked (`BID_DEFAULT_ACCOUNTING_TREATMENT = null`, `projection/bid-refunds.ts:368`) and Release refused for it by the 0385 trigger. D5 decides it; build per #1576. Re-invoice after a credit note and direct bank refunds are not built. |
| 10. Shop invoices | #1366 | `shop.accounting.order_paid` → invoice under the Shop's `LAX-INV-` number + payment (0383). | **Done (rehearsal).** | Shop lines carry stored standard-rate VAT; London Art Exchange is configured not VAT registered, so they are refused until Q-VATREG. Outside-UK delivery parked (Q-ZERO). |
| 11A. Shop refunds | #1380 | Shop credit notes and refunds from clearing (0388). | **Done (rehearsal).** | Buyer-facing Shop credit notes not shown (size budget). |
| 11B. Shop originals | #1384 | Originals sold directly invoiced by Books with a Stripe Payment Link (0389). | **Done (rehearsal).** | — |
| 12. Payout bills | #1460 | Seller and artist payouts as bills and bill payments (0394). | **Done (rehearsal), all parked.** | Q-COMMISSION, Q-AGENT, Q-PRIVATE; payouts marked paid outside Stripe park; `payout.reversed` has no document. |
| 13. Stripe fees, payouts, reconciliation | #1376, #1404 | Fees as expenses, Stripe payouts as transfers, daily reconciliation report (0386). | **Done (rehearsal).** | Stripe fees and bank account ids per organisation (Q-ACCOUNTS); `STRIPE_BOOKS_READ_KEYS` for test. |
| 14. Notices and nightly status | #1377 | Signed Books notices (`/webhooks/zoho-books/notices`), nightly read-back (0387). | **Done (rehearsal).** | Signature format and the Books workflow must be set up and confirmed on each test organisation. |
| 15. History import, backfill, cutover runbook | #1387, #1481 | `books:import-shop-history`, `books:backfill`, `docs/runbooks/zoho-books-cutover.md`. | **Done, now obsolete (D1).** | Remove the import; keep `books:backfill` only as an outage tool without the Xero cutover instant; rewrite the runbook as a go-live runbook. |
| 16. Test organisations and live adapters | — | — | **Not started.** | Token store, connect flow, HTTP adapter in `byMode.test_org`/`live`, `BOOKS_ORGANISATIONS`, PDF fetch, infra variables. |
| 17. Switch over | — | — | **Not started; replaced** by the go-live and Xero removal PRs (section 6). | — |

Related fixes already on `main`: #1404 (reconciliation known-unbooked types), #1415 (VendorPort in
the domain), #1431 (refund reversal alert), #1566 (Books VAT rule for partial credit notes),
#1393 (test Terraform variables for `ZOHO_BOOKS_ORG_CONFIG` and `ZOHO_BOOKS_NOTICE_SECRET`; the
matching variables in the separate infra repository are still needed).

## 2. Remaining work

### A. Buildable now (no test organisation, no accountant answer)

Everything here runs against the in-memory fake and `SimulatedBooks`; nothing reaches Zoho.

1. **Retire the Xero-era cutover machinery (D1).** Delete `books:import-shop-history`
   (`apps/worker/src/scripts/books-import-shop-history.ts`, `shop-history-import.service.ts`,
   `drizzle-books-history.reader.ts`, `shop-history-books.integration.test.ts`) and its imported-history
   email exemption work. Keep `books:backfill` but drop `--not-before` / the cutover instant: it becomes
   "re-project a window after a projector outage". Rewrite `docs/runbooks/zoho-books-cutover.md` as
   `docs/runbooks/zoho-books-go-live.md` (section 5's checklist, positions off → dry run → test org →
   live, no Xero).
2. **Remove the projector's "Xero is live" state from the Books path.** Books must not depend on
   `xero_mode` to decide a target. Introduce a Books-only switch reader so the Xero columns can be
   dropped later without touching the sender (section 4, step X2).
3. **Token store and connect flow.** `DrizzleZohoTokenStore` over `zoho_books_connection` (compare-and-set
   on `version`), and a staff-only connect flow (OAuth authorisation-code grant on `accounts.zoho.eu`,
   sealed with `ZOHO_BOOKS_TOKEN_DEK_KEY`, step-up required, one connection per organisation), with a
   "Books connection" status card on Finance › Accounting replacing the Xero status card.
4. **Books PDF fetch.** Binary transport in the client and `adapter/pdf.ts` so LAX keeps its own copy
   of every issued invoice and credit note (today `zoho_books_pdf_not_built`). Contract-tested on the
   simulator.
5. **Compose the HTTP adapter for `test_org` (and `live`, refused until bound).** In
   `createBooksAccountingAdapters`, build `createZohoBooksAdapter` with `createZohoBooksHttpClient({ redis })`
   and `writes: { mode, organizationIds }` from `BOOKS_ORGANISATIONS`. With the binding empty (as today)
   nothing is reachable, so this can merge before the ids exist. The worker and API both read it.
6. **Buyer default as credit note (D5).** Land #1576's guards, set `BID_DEFAULT_ACCOUNTING_TREATMENT =
   "credit_note"`, lift the 0385 release guard for `accounting_parked_buyer_default_treatment` in a
   forward migration, void only when the invoice was never sent (`checkVoid`).
7. **Re-invoice after a credit note (D5).** `bid_invoice.follows_invoice_id`, a "Re-invoice" staff action,
   and the Books projection of the new invoice (new LAX reference, same lot).
8. **Refunds to source only, two-person bank refunds (D5).** Refuse a Stripe bank-transfer refund whose
   sending account is unknown; `direct_bank_refund` request → approve (a different person) → recorded
   in Books against the cancelling credit note.
9. **Buyer-facing invoice from Books, not Xero.** The buyer's invoice link and number come from LAX's
   stored Books copy (`accounting_document_copy`), never from `xero_online_invoice_url` /
   `xero_invoice_number` (`apps/api/src/services/payment-me-presenter.ts:26-130`).
10. **Replace what Xero's webhook did.** Xero invoice webhooks re-sync invoice status into LAX
    (`xero-webhook-ingress-application.service.ts:83-117`, `accounting-replay-cron.service.ts`). In Books,
    the nightly status check and notices (step 14) only open finance tasks and never apply money; confirm
    no LAX state depends on the Xero sync before the Xero side is deleted (section 4).
11. **Payout reversal.** `payout.reversed` / `payout.transfer_reversed` after a bill payment: hold for a
    person with an alert (no automatic reversing document).
12. **Locked-period re-date.** "Book on today's date" action for `*_period_locked` (today Try again
    resends the same document).
13. **Opening restatement for Stripe sync** at a mode switch (follow-up noted in #1376), so test → live
    starts the clearing figure from the go-live day.
14. **Xero removal, code that is dead under D2 regardless of the proof:** everything in section 4 that
    is not on the money path (admin pages, reports, exports, docs) can be prepared now, but merged only
    in the order of section 4.

### B. Needs the test Books organisation ids

1. **Create the two free test organisations** (London Auction Xchange test, London Art Exchange test)
   in the EU data centre, with the custom field for the LAX reference (unique), the chart of accounts,
   tax rates and numbering per the accountant's draft settings.
2. **Bind them:** `BOOKS_ORGANISATIONS = { test_org: { bid: <id>, shop: <id>, lax_art: <id> } }`
   (organisation ids are not secret), `ZOHO_BOOKS_ORG_CONFIG_TEST` and `ZOHO_BOOKS_NOTICE_SECRET_TEST`
   GitHub secrets validated with `pnpm books:validate-org-config`, the infra repository variables from
   #1393, `ZOHO_BOOKS_TOKEN_DEK_KEY` and the Zoho OAuth client for test, then a Terraform apply on test.
3. **Connect each organisation** through the connect flow (A3).
4. **Confirm against real Books** every "to confirm in the test organisation" item: list filter on the
   custom field, the duplicate-value code, period-lock code 4151, field names read back for invoices,
   credit notes, payments, `/vendorpayments`, `/expenses`, `/banktransactions`, contact type, "apply
   credits", PDF endpoint, the notice signature format. Fix the mappers where Books differs.
5. **Switch both products to `test_org`** and run the section 5 proof.
6. **Confirm Q-ROUNDING empirically** on the test organisation (3p of a 25p line) alongside the accountant.

### C. Needs accountant answers

| Item | Question | Code change once answered |
| --- | --- | --- |
| C1 VAT registration per company | Q-VATREG | `vatRegistered` and tax ids in each organisation's settings; Shop lines with stored VAT are then sent (registered) or the Shop VAT policy changes (not registered). |
| C2 Buyer's premium, hammer, ARR, import VAT | Q-PREMIUM | `BID_LINE_BOOKINGS` rows; remove kinds from `BID_LINES_AWAITING_ACCOUNTANT`. |
| C3 Seller commission and payouts | Q-COMMISSION | `BID_SELLER_PAYOUT_BOOKING`; rebuild parked `seller_payout_treatment` bills. |
| C4 Shop artists, private sales | Q-AGENT, Q-PRIVATE | `SHOP_ARTIST_PAYOUT_BOOKING`; mapping for private-sale lines. |
| C5 Outside-UK goods and delivery, courier VAT | Q-ZERO | `SHOP_OUTSIDE_UK_DELIVERY_BOOKING`, `DELIVERY_BOOKING`; staff Release of parked drafts. |
| C6 Storage and late interest | Q-STORAGE | New line roles and bookings before either can be invoiced through Books. |
| C7 Rounding | Q-ROUNDING | None if half-up per line; otherwise `vatInsideGross` and `creditLines`. |
| C8 Year end, VAT quarters, opening balances | Q-YEAREND, Q-QUARTER, Q-OPENING | Organisation settings and the go-live date; opening balances entered in Books by the accountant. |
| C9 Accounts | Q-ACCOUNTS | Live `ZOHO_BOOKS_ORG_CONFIG` (and the test copy mirrors it). |

Go-live needs C1, C2, C8 and C9 at least; C3 to C6 can follow while their documents stay parked,
provided the accountant accepts parked documents being booked late (or by hand).

## 3. Shop/Art to Books from day one

Plan v2 treated the Shop as an **import**: Shop invoices before the cutover were to be copied from
Xero with their `LAX-INV-` numbers (F18), and the Shop moved to Books in the same cutover window as
Bid because `XERO_API_WRITES_DISABLED` is global. Under D1 and D2 there is no history and no window:
from go-live every paid Shop order, refund, original sale and artist payout posts **live** to London
Art Exchange Ltd's organisation, exactly as rehearsed by PRs 10, 11A, 11B and 12.

What that means in practice:

- **Nothing in Xero to copy, nothing to reconcile against Xero.** The Shop never wrote to Xero from
  code (the Xero projector only handles Bid events: `apps/worker/src/integrations/xero/xero-projector-config.ts`).
  Shop invoices so far live in LAX only (`shop_order.invoice_number`, LAX's own PDF). The accountant
  decides how pre-go-live Shop sales appear in the opening balances (Q-OPENING).
- **Numbering continues.** Books receives `LAX-INV-…` with automatic numbering off, from the Shop's
  `shop_invoice_counter`, so numbering stays continuous for the buyer. The first number sent live is
  whatever the counter holds on go-live day; the test organisation receives numbers from the test
  database only.
- **Products.** `shop` and `lax_art` both map to London Art Exchange Ltd (`legalEntityFor`,
  `packages/accounting-domain/src/document.ts:51`). No flow emits `lax_art` today; lax.art sales that are
  Shop orders or Shop originals are booked as `shop`. Private deals settle through payouts (Q-PRIVATE).
  The `lax_art` switch row is set to the same mode as `shop`.
- **VAT is the blocker, not code.** London Art Exchange is configured as not VAT registered; Shop
  orders store standard-rate VAT, so every Shop line with VAT is refused today. Q-VATREG decides which
  way this goes before Shop can go live.
- **Buyer email.** "Your invoice" for Shop goes only for invoices Books issues live, with the storefront
  link (`SHOP_STOREFRONT_URL`). With no imported history there is nothing to exclude.
- **Originals.** Under Books live, staff get a Stripe Payment Link and Books issues the invoice (#1384);
  under any other mode they still issue a Stripe Invoice. Both organisations go live together, so
  there is no period with a mix.
- **Day-one switch.** The Shop goes `off → dry_run → test_org` on test, and straight to `live` on
  production on go-live day, with Bid, with `xero_mode` gone (section 4).

## 4. Xero removal inventory

Taken from `git grep -il xero` on `main` at #1575: **454 files** (156 of them tests), plus 5 files
with Xero only in their path (`packages/db/src/xero-token-sealing/index.ts` and the 4 screenshots in
`docs/design/screenshots/xero-reconnect-required/`). By area: `apps/api` 125, `apps/worker` 65,
`apps/web` 59, `packages/persistence` 35, `packages/finance-runtime` 22, `packages/db` 20 + 10
migrations, `packages/types` 14, `packages/background-runtime` 12, docs 42, and about 30 others
(CI, env files, scripts, `shop-*`, staff-ui, exports, validators, queues, finance-cron-app).

"Replaced by" names the Books path that already covers the job, or **delete** when nothing replaces
it. **Rework** means the feature stays and only its Xero step goes.

### 4.1 Packages and dependencies

| Item | Where | Replaced by |
| --- | --- | --- |
| `xero-node` ^9 | `apps/api/package.json:84` (one `import type { TokenSet }` in `services/xero-oauth.service.ts`) | delete |
| `xero-node` ^10 | `apps/worker/package.json:66` (not imported directly) | delete |
| `xero-node` ^10 | `packages/finance-runtime/package.json:34` (the SDK user: `src/accounting/xero-*.ts`, `src/bill-to-xero.ts`) | delete; regenerate `pnpm-lock.yaml` and check that the transitive `openid-client@5` and `axios` have no other dependants |
| `@auction/db/xero-token-sealing` export and `db:backfill-xero-token-sealing` | `packages/db/package.json:19-21,57`, `packages/db/src/xero-token-sealing/*`, `src/scripts/backfill-xero-token-sealing.ts` | delete. The Books sealer (`accounting-zoho-books/src/token-sealer.ts`) uses `@auction/identity-contracts` directly and does not depend on it |

### 4.2 Environment variables

Read by `apps/api/src/env.ts` and/or `apps/worker/src/env.ts` (and `packages/finance-runtime/src/env-slice.ts`):

| Variable | Read by | Declared / passed in | Replaced by |
| --- | --- | --- | --- |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`, `XERO_TOKEN_DEK_KEY` | API, worker | `.env.example`, `.env.production.example`, `turbo.json`, `docker-compose.prod.yml`, 5 Terraform workflows | Books OAuth client settings and `ZOHO_BOOKS_TOKEN_DEK_KEY` (section 2A3) |
| `XERO_WEBHOOK_KEY`, `XERO_WEBHOOK_INBOX_MODE` | API | `.env*`, `turbo.json`, compose (key only), 5 workflows (key only) | `ZOHO_BOOKS_NOTICE_SECRET` |
| `XERO_POST_CONNECT_WEB_REDIRECT` | API | `.env.production.example`, `turbo.json`, compose, 5 workflows | Books connect flow redirect |
| `XERO_DEFAULT_REVENUE_ACCOUNT_CODE`, `XERO_DEFAULT_TAX_TYPE`, `XERO_PAYOUT_BILL_ACCOUNT_CODE`, `XERO_USE_LEGAL_ENTITY_CONTACT` | API, worker | `.env*`, `turbo.json`, compose (first two), prod Terraform workflows | `ZOHO_BOOKS_ORG_CONFIG` (accounts, tax ids per organisation) |
| `XERO_INVOICE_BLOCKING` | API | `.env*`, `turbo.json`, compose, prod workflows | delete (Books invoices come from events, never block checkout) |
| `XERO_PAYMENT_BANK_ACCOUNT_CODE` | API, worker | `.env.production.example:351` only | `payments.depositAccountId` in `ZOHO_BOOKS_ORG_CONFIG` |
| `XERO_API_WRITES_DISABLED` | API, worker, finance-runtime `xero-api-writes-guard.ts` | `.env.example:402` only (not passed by turbo, compose or workflows: must come from the infra repository) | delete with the writers; until then set `true` on test for the proof (section 5) |
| `XERO_PROJECTOR_MODE`, `XERO_PROJECTOR_LIVE_OPERATIONS` | worker (`lib/runtime-ownership-config.ts`, `integrations/xero/xero-projector-config.ts`), background-runtime `validate.ts:96` | nowhere (defaults) | delete |
| `TF_VAR_xero_invoice_due_days` | no consumer in this repository | prod workflows | delete |

CI and Terraform: `terraform-apply-prod.yml` and `terraform-plan-prod.yml` pass 12 `TF_VAR_xero_*` each;
`terraform-apply-test.yml`, `terraform-apply-test-dispatch.yml` and `terraform-test-up.yml` pass 6 each.
GitHub secrets: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_TOKEN_DEK_KEY`, `XERO_REDIRECT_URI`,
`XERO_WEBHOOK_KEY`, `XERO_POST_CONNECT_WEB_REDIRECT`. The matching `variable "xero_*"` blocks and
container env mappings are in the separate infra repository. Order: the infra repository makes them
optional, this repository drops the `TF_VAR` lines, the infra repository deletes the variables, then
the secrets are deleted. Removing a variable first fails plan and apply on an undeclared `TF_VAR`.

Constants and Redis keys that go with their modules: `xero:refresh:` lock prefix, `xero:oauth_state:<state>`,
`XERO_SCOPES`, `XERO_CAPTURE_VIAS`, `XERO_CONSUMER`/`XERO_EVENT_TYPES`, `XERO_LIVE_LOCAL_OPERATIONS`,
`PAYMENT_XERO_FILTERS`, `XERO_SYNC_STATUS_LABELS`, `XERO_CALLBACK_ERROR_MESSAGES`, `XERO_FILTERS`.

### 4.3 Database

New migrations start after `0408`; each needs its `_rollback.sql`, journal entry and Drizzle schema change.

| Object | Created in | Schema | Data |
| --- | --- | --- | --- |
| `xero_connection` (+ indexes, enum `xero_connection_status`, health columns, sealed token columns and checks) | 0016, 0078, 0367 | `schema/xero-integration.ts` | Drop, after revoking the app in Xero. |
| `payment_external_ref` (+ enum `payment_external_sync_status`, indexes) | 0016 | same | The only link from a Bid payment to its Xero invoice. Under D1 nothing moves to Books; if any environment that must keep records (production) holds rows, export them to private storage before the drop. On test, drop. |
| `xero_webhook_event` (+ indexes from 0042) | 0016, 0042 | same | Drop. |
| `legal_entity.xero_contact_id` | 0027 | `schema/legal-entities.ts:91` | Export if production holds values, then drop. Books keeps its own contacts by LAX reference. |
| `payout.xero_bill_id` | 0027 | `schema/payouts.ts:66` | As above. Books bills are `accounting_document` rows (kind `bill`). |
| `accounting_source_setting.xero_mode`, `accounting_source_setting_xero_mode_ck`, `accounting_source_setting_one_live_ck`, generated `live_source`, seed `('bid','live','off')` | 0368 | `schema/accounting.ts:185-202` | Drop the column and checks; `live_source` is generated from `xero_mode`, so drop and recreate it (or drop it) in the same migration. |
| `accounting_document.provider` / `target_provider` checks `IN ('xero','books')` | 0368 (+0374 unique key) | `schema/accounting.ts:57,59` | Count rows with `'xero'` first (expected 0), then narrow to `'books'`. |
| Rows in shared tables | `domain_event_delivery` (consumer `xero`), `projector_state` (`xero`), `webhook_event` (source `xero`) | — | Purge. `audit_log` history is kept. |

Grants (`packages/db/src/migrate-roles.ts`): `WORKER_FINANCE_INTEGRATION_TABLES` (L1077-1083) loses the
three Xero tables and keeps `payment_refund_reconcile`; `SHOP_ACCOUNTING_READ_COLUMNS` (L594) gives
`shop_app` a column grant on `xero_mode` and must change in the same release as the drop. Role contract
tests (`api-app-role.contract.test.ts`, `worker-app-role.contract.test.ts`, `migrate-roles.test.ts`),
migration tests (`migration-0367-*`, `migration-0368-*`, `migration-0374-*`, `migration-0389-*`) and the
dev seed (`seed/dev/legacy-demo-seed.ts`: Xero tables, `xeroContactId`, `xeroBillId`,
`xero_payout_bill_sync`) change with them.

### 4.4 Jobs, crons, projectors, webhooks

| Item | Files | Replaced by |
| --- | --- | --- |
| Cron `refresh-xero-tokens` (6 h) | `packages/queues/src/queue-names-finance-cron.ts`, `registries/finance-cron.ts`, worker `workers/register-finance-cron-workers.ts`, `jobs/payment-ops-cron.ts` | Books token manager refreshes on use |
| Cron `retry-xero-webhook-failures` (15 min) | same | Books nightly status check (`accounting-reconcile`) and notices |
| Cron `retry-xero-stripe-capture-sync` (15 min) | same | `accounting` projector (Bid payments) and `stripe-books-sync.service.ts` |
| Cron `retry-xero-invoice-creation` (15 min) | same | `accounting` projector and sender retries |
| Repeatable schedules already in Redis and their Sentry cron monitors | registered with `repeat` | one-off `removeRepeatable` for the 4 job ids (pattern in `register-webhook-worker.ts`); delete the monitors |
| `ensure-lot-invoices` | `background-runtime/src/registry.ts:52`, finance-runtime `lot-invoice-initiation.service.ts:15,75,277-286` | **Rework**: keep raising payment rows, drop `ensureXeroInvoiceForPayment` |
| `retry-refund-reconciles` | `packages/finance-cron-app/src/accounting-replay-cron.service.ts`, `accounting-replay-ports.ts` | **Rework**: keep the cron, delete the Xero credit-note step (Books: Bid refund credit notes) |
| Finance cron paths | `background-runtime/src/finance-cron-paths.ts`, `finance-ownership-matrix.ts`, `finance-cron-app/src/finance-cron-paths.ts`, worker `finance-cron-dispatch.ts`, `create-worker-finance-cron.ts` | delete the 4 Xero paths |
| Ownership registry and smoke gates | `background-runtime/src/{registry,types,validate,smoke-gates,runtime-ownership-smoke-gate-map,domain-event-smoke-gates,domain-event-smoke-gate-map,index}.ts` | delete entries **in the same PR** as the test files they point at |
| Domain-event projector `xero` | `apps/worker/src/projectors/xero-projector.ts`, `xero-payout-bill-sync.ts`, `projector-registry.ts:60,105`, `lib/projector.types.ts`; `scripts/ci/worker-projector-names.mjs:27` | `accounting` projector |
| Catalogue consumer `"xero"` | `packages/types/src/domain-event-catalog/registry.ts` (5 events), `types.ts:19`, `financial-payload-schemas.ts:163` (`lotEndedXeroPayloadSchemaV1`) | `accounting` consumer (already listed) |
| Xero live executor (worker calls API `/internal/jobs/xero-*`) | `apps/worker/src/integrations/xero/*` (7 files), `container/create-worker-container.ts:636-640,729-740` | delete |
| Inbound webhook dispatch `xero` | API `xero-webhook-ingress-application.service.ts`, worker `jobs/process-inbound-webhook-event.ts:28,67-83,163` | Books notices (`/webhooks/zoho-books/notices`) and status check; the Xero sync only records the Xero payment id and changes no payment state |

### 4.5 API (`apps/api/src`)

Routes to delete: `GET /admin/integrations/xero/status`, `GET …/oauth/consent-url`,
`POST …/oauth/complete`, `POST …/disconnect` (`routes/xero-admin.ts`, mounted in
`routes/admin/finance.routes.ts`); `POST /admin/payments/:id/xero-sync`; the `?xero=` filter on the
admin payments list (`routes/admin/payments.routes.ts:36`); `POST /webhooks/xero` (`routes/xero-webhook.ts`,
`app.ts`); `POST /internal/jobs/xero-payout-bill`, `retry-xero-webhook-failures`, `refresh-xero-tokens`,
`retry-xero-stripe-capture-sync`, `retry-xero-invoice-creation`, `xero-sync-invoice-webhook`,
`xero-record-stripe-capture`, `xero-record-refund-credit-note`, `xero-acknowledge-payout-settlement`
(`routes/internal-cron.ts`); access rules in `routes/admin.ts:207-208`; route-DIP lists in
`apps/api/scripts/check-*-dip*.mjs`; `docs/openapi.yaml`. **Rename, do not delete,**
`ContainerXeroWebhookRoutesSlice` (`container/container-slices.ts:848`): the Books notice route uses it.

Services to delete: `services/accounting/xero-*.ts` (11 re-exports of finance-runtime),
`services/xero-oauth.service.ts`, `services/bill-to-xero.ts`, `services/payment/ensure-xero-invoice.ts`,
`services/admin/admin-xero-application.service.ts`, `services/finance/xero-webhook-ingress-application.service.ts`,
`lib/xero-api-writes-guard.ts`, `lib/xero-webhook-signature.ts`, the Xero methods of
`services/finance/finance-accounting-cron-application.service.ts`.

Rework (the money flow stays; Books already receives the same facts through domain events):

| File | Xero step today | After |
| --- | --- | --- |
| `services/payment/checkout-orchestrator.ts:21,46,205-226`, `container/create-payment-group-services.ts` | Creates a Xero invoice at checkout (`xeroInvoiceBlocking`, 503 `accounting_unavailable`) | none; `invoice.raised` → Books |
| `services/payment/payment-capture.service.ts:11,30,199-205` | Records the capture in Xero | none; `payment.captured` → Books |
| `services/payment/refund-execution.ts`, `payment-refund-ops.ts` | Xero credit note on refund | none; `payment.refunded` → Books credit note |
| `services/payment/payment-admin-ops.ts`, `payment.service.ts`, `payment-service-types.ts`, `admin/admin-payments-application.service.ts` | Admin Xero backfill and sync | Finance › Accounting Try again / Release |
| `services/cron/settlement-cron.service.ts:40-41`, `finance/internal-cron-application.service.ts` | Xero payout bill | `payout.settlement_created` / `payout.paid` → Books bill |
| `services/payment-me-presenter.ts:26-30,129-130` | Buyer invoice link and number from `payment_external_ref` | LAX's Books copy (`accounting_document_copy`, purchase invoice card) |
| `subject-export/categories/invoices.category.ts` | DSAR lists Xero invoice numbers | Books documents |
| `services/admin/admin-payment-list-query.service.ts`, `organization-onboarding.service.ts:81` | Xero filter, `xeroContactId` | Books document state, or drop |
| Failed jobs: `admin/failed-jobs/sources/integration-registry.ts`, `integration-deliveries.source.ts`, `integration-payload-mask.ts`, `routes/admin/failed-jobs.routes.ts`; `middleware/dangerous-staff-actions.ts:310` | Source `integrations.xero` | `integrations.books` stays |
| Containers: `container.ts`, `container/create-{payments-services,cron-services,finance-route-services,payments-repos,repositories,admin-services}.ts`, `services/admin/create-admin-*-services.ts`, `interfaces/admin-routes/*`, `interfaces/finance-routes/*`, `lib/runtime-ownership-config.ts` | Wiring | delete wiring |

About 45 API test files carry Xero fixtures or mocks and change with these.

### 4.6 Worker (`apps/worker/src`)

- **Rework:** `finance/create-worker-finance-services.ts` (builds `createXeroAccountingStack`, sets the
  payment maintenance provider, Xero cron handlers), `finance/create-worker-lot-invoice-initiation.ts:64-94`,
  `finance/worker-payment-maintenance-adapter.ts:25-47`, `jobs/payout-statement.renderer.ts:140` and the
  payout statement repository ("Xero bill id" on the seller statement: print the Books bill number or drop it),
  `subject-export/summary.content.ts:38,62,88` (DSAR copy names Xero as the accounting processor).
- **Delete:** `finance/worker-ensure-lot-invoices.ts` (not imported anywhere; it also passes a lot id
  where a payment id is expected), Xero cron stubs and dispatch, `jobs/payment-ops-cron.ts` Xero jobs,
  the `xero` branch of `jobs/process-inbound-webhook-event.ts`, `projectors/xero-*`, `integrations/xero/*`,
  env entries and container wiring.
- **Books code naming Xero:** `finance/accounting/accounting-projection.service.ts:187`,
  `books-backfill.service.ts:18`, `repositories/drizzle-books-history.reader.ts` (deleted with the import),
  `testing/in-memory-accounting-store.ts:53-82` (default `bid: { xero: "live" }` models "Books off":
  change to `books: "off"`), and 22 Books integration tests that set `xero_mode`.

### 4.7 Web and staff UI

- **Delete:** `apps/web/src/app/admin/(finance)/integrations/xero/` (`page.tsx`, `loading.tsx`, `error.tsx`,
  `callback/route.ts`; the `integrations/` folder holds nothing else; redirect the path to
  `/admin/finance/accounting`), `components/admin/xero-integration-panel.tsx`,
  `lib/admin/finance/load-xero-integration-page.ts`, `lib/admin/finance/xero-callback-error.ts`,
  `lib/admin/xero-sync-status-presenter.ts`, `lib/admin/xero-sync-status.copy.ts`, the Xero server actions in
  `lib/actions/admin/admin-payments.ts:115-167` and `lib/actions/admin.ts:81-88`, the Xero parts of
  `lib/data/http/admin-payments.{reader,schema,server,types}.ts`, `lib/services/impl/admin-payment-ops.service.ts`.
- **Navigation:** `components/layout/staff-nav.ts:427-432` (Xero item) and `L623` (`FINANCE_MOBILE_TAB_IDS`:
  replace `"xero"` with `"accounting"`); finance hub card `lib/admin/finance/finance-hub.vm.ts:157-160`;
  `scripts/staff-list-template-allowlist.json:22`; e2e `e2e/helpers/staff-routes.ts:45`, `e2e/admin-a11y.spec.ts:178-179`.
- **Rework:** payments list and quick view (`components/admin/payments/payments-staff-list.tsx`,
  `payment-quick-view.tsx`, `lib/admin/finance/payments-staff-list.vm.ts` with the saved views "Captured, no
  invoice yet" and "Invoice sync failed", `lib/admin/list-controllers/payments-list-controller.ts`,
  `lib/admin/build-payments-list-page-model.ts`, `app/admin/(finance)/payments/loading.tsx`),
  `components/admin/admin-user-commerce-panel.tsx:88-93`, `lib/data/http/admin-parse.server.ts`,
  `lib/data/view-models/admin-payments-table.vm.ts`, `admin-legal-entities.schema.ts:128`,
  `seller-payouts.schema.ts:40`, buyer `lib/data/view-models/dashboard-payments.vm.ts:27` (opens the hosted
  Xero invoice). Replacement: the Books document number and state from the accounting queue, and the
  buyer's purchase invoice card (already on Books).
- About 25 web test files and 5 `packages/staff-ui` tests use Xero only as fixture text.

### 4.8 shop-api and shop-admin

No Xero write path. `apps/shop-api/src/infrastructure/drizzle-order-invoice-books.reader.ts:24-36` reads
`xero_mode` for `booksTargetMode` and must ship the Books-only switch **before** the column is dropped
(tests: `drizzle-order-invoice-books.integration.test.ts`, `phase/original-sale-books.integration.test.ts`).
shop-admin tests list the `integrations.xero` failed-job source
(`server/domain/zoho-mirror.vm.test.ts`, `app/(staff)/orders/[orderId]/page.test.tsx`).

### 4.9 Shared packages

- **finance-runtime:** delete `src/accounting/xero-*.ts`, `src/bill-to-xero.ts`, `src/create-xero-accounting-stack.ts`,
  `src/ensure-xero-invoice.ts`, `src/xero-api-writes-guard.ts`, the Xero env slice, `src/interfaces/invoice-accounting.ts`
  and `src/accounting/no-op-accounting.provider.ts` (only the Xero path uses them), exports in `src/index.ts`;
  rework `src/lot-invoice-initiation.service.ts`.
- **persistence:** delete `interfaces/xero.repository.ts`, `repositories/drizzle-xero-connection.repository.ts`,
  `drizzle-xero-webhook-event.repository.ts`, `drizzle-payment-external-ref.repository.ts`; rework
  `drizzle-payment.repository.ts` (admin list joins), `drizzle-payment-refund-reconcile.repository.ts`
  (`listPendingStripeCaptureSync`, `listPaymentsMissingXeroInvoice`), `drizzle-account-record-search.reader.ts`
  (staff search by Xero invoice number), `drizzle-bid-portfolio.reader.ts`, `drizzle-legal-entity.{reader,repository}.ts`
  (`setXeroContactId`, `findPrimaryAddressForXero`), `drizzle-payout.repository.ts` (`updateXeroBillId`), and the
  accounting switch reader and writer (`repositories/accounting/drizzle-accounting-source-setting.{reader,writer}.ts`,
  `drizzle-accounting-document.registry.ts:78`, `drizzle-accounting-document.work-queue.ts:43,173,201`).
- **types:** `failed-job-sources.ts`, `failed-jobs.ts` (`integrations.xero`), `legal-entity.ts:73`, `payout.ts:51`,
  `audit-log.ts:17` (`xero.` filter prefix: keep for history or remove), `domain-event-catalog/*`,
  `domain-event-pii/allowlists.ts:14`.
- **validators:** delete `xero.ts`; `payment.ts:37-54` (`adminPaymentXeroFilterSchema`).
- **exports:** `providers/payments.provider.ts` (CSV filter `xero` and column `xero_invoice`: a user-visible
  export change), `ports/*`, `infrastructure/drizzle-export-payout.reader.ts:22`.
- **domain:** `src/purchase-invoice-state.ts:65` (comment).
- **accounting-domain:** `src/source-switch.ts` (`SOURCES = ["xero","books"]`, `ProductSwitch`,
  `validateProductSwitch`, `documentTarget`, `booksTargetMode`, `mayClaim`) becomes Books-only:
  `ProductSwitch = { books: Mode }`, `two_live_sources` removed. README sections on rehearsing beside Xero.
- **accounting-zoho-books:** comments only (README "Xero → Zoho Books move", token-sealer parity note).

### 4.10 Scripts, CI and config

`scripts/ci/authorize-cutover-preflight.mjs:11`, `scripts/ci/worker-projector-names.mjs:27`,
`scripts/circular-deps-allowlist.json:118`, `scripts/staff-list-template-allowlist.json:22`,
`scripts/ci/verify-client-copy.mjs:44` (forbids "Xero" in client copy: keep, it is still a valid guard),
`turbo.json:106-117` (12 entries), `docker-compose.prod.yml:87-96,175-178`, `.env.example:230-231,358-402`,
`.env.production.example:298-351`, `.gitleaks.toml:30` and `.gitleaksignore:9` (allow-list the Xero runbook;
remove with it), the 5 Terraform workflows. Metrics `xero_invoice_deferred`, `xero_invoice_backfilled`,
`xero_payment_record_failed`, `xero_refund_credit_note_failed` and any alert rules on them.
Outside the repository: the Xero app (redirect URI, webhook subscription) in the Xero developer portal,
the Sentry cron monitors, the infra repository variables.

### 4.11 Docs

Delete `docs/runbooks/xero-stripe-payment-setup.md`, `docs/runbooks/xero-token-loss.md`,
`docs/design/screenshots/xero-reconnect-required/`. Replace `docs/runbooks/zoho-books-cutover.md` (PR 1).
Edit: `docs/runbooks/{worker-runtime-cutover,atg-manual-settlement,async-delivery-phase-two,buyer-payment-flow,bid-checkout-go-live-notes,monitoring-alerts,stripe-connect-go-live,dispute-clawback,test-campaign-ops-pack,stripe-incident}.md`;
`docs/architecture/0{1,2,3,4,6,7}-*.md` (add an ADR in `02-decisions.md`: Xero removed, Books only);
`docs/SYSTEM_ANALYSIS.md`, `docs/DIAGRAMS.md`, `docs/README.md`, `docs/LOAD_TESTING.md`;
`docs/security/secrets-management.md`, `docs/security/dpas.md` (Xero as data processor; the DPA list
changes); `docs/openapi.yaml`; `docs/integrations/atg.md`; `docs/onboarding/0{1,3,4,5}-*.md`;
`docs/ui/{redesign-program,staff-ui-architecture,staff-route-redesign-matrix}.md`;
`docs/design/storage-terms.md`; `packages/accounting-domain/README.md`, `packages/accounting-zoho-books/README.md`.

### 4.12 Safe removal order

Each step is its own PR (section 6, PRs 14–17) and merges only after the section 5 proof. API, worker
and web call each other, so each step ships in one release.

| Step | What | Must hold first | Acceptance |
| --- | --- | --- | --- |
| X0 (ops) | `XERO_API_WRITES_DISABLED=true` and `XERO_PROJECTOR_MODE=off` on every environment; Xero webhook subscription deleted and the app's connection revoked in Xero; `domain_event_delivery` rows for consumer `xero` settled; exports taken (section 4.3) where an environment must keep records. | Section 5 passed. | No Xero call in logs for 7 days; nothing in Failed jobs under Xero. |
| X1 | **Stop writing.** Worker: projector, live executor, 4 crons (+ `removeRepeatable`, Sentry monitors), inbound dispatch, catalogue consumer `"xero"`, smoke-gate entries. API: `/internal/jobs/xero-*`, `/webhooks/xero`, Xero steps in checkout, capture, refund, lot invoice initiation and settlement. finance-runtime and finance-cron-app Xero code. | The `accounting` projector carries every Bid flow on test (section 5). | `git grep -il xero` empty in `apps/worker`, `packages/finance-runtime`, `packages/finance-cron-app`, `packages/queues`, `packages/background-runtime`; checkout, capture, refund and settlement suites pass. |
| X2 | **Stop reading and showing.** API admin Xero routes and `?xero=` filter, web Xero pages, nav, hub card, payments list/quick view, buyer invoice link (PR 9 already moved it to Books), staff search, portfolio, DSAR, CSV export, failed-job source `integrations.xero` (types, API, web, shop-admin). Persistence repos stop selecting Xero columns. Books-only switch everywhere, shop-api included (PR 2). | X1 released. | No code reads `xero_connection`, `payment_external_ref`, `xero_webhook_event`, `xero_contact_id`, `xero_bill_id` or `xero_mode`; e2e and a11y pass on the payments pages. |
| X3 | **Drop the schema** (expand/contract: one release after X2). Migration drops the three Xero tables and enums, `xero_contact_id`, `xero_bill_id`, `xero_mode` and its checks, recreates `live_source`, narrows the `accounting_document` provider checks; purges Xero rows in shared tables; grants and role contract tests; Drizzle schema; seed. | X2 released; exports taken; `SELECT count(*) FROM accounting_document WHERE 'xero' IN (provider, target_provider)` is 0. | Migration and rollback tested on PostgreSQL 16; `db:roles` passes. |
| X4 | **Config, dependencies, docs.** Infra repository variables, `TF_VAR_xero_*` lines, GitHub secrets (`XERO_TOKEN_DEK_KEY` only after X3), `turbo.json`, compose, `.env*`, `xero-node` ×3 and lockfile, `@auction/db/xero-token-sealing`, gitleaks entries, docs, ADR, DPA list. | X3 released. | `git grep -il xero` returns only historical migrations (and their tests), the ADR and this document; Terraform plan clean on test and prod. |

## 5. End-to-end proof on test (all must pass before any Xero removal PR merges)

Run on the test environment with both products at `test_org`, each bound to its own test
organisation. Each line is checked in Books **and** in LAX (Finance › Accounting shows the document
issued, with its Books number and link; nothing unexplained in "Needs a person"). Record evidence
(Books document number, LAX reference, amounts) in `docs/pr-evidence/books-test-proof/`, with no
personal data.

**Set-up**
- [ ] Both test organisations connected (connection status "Connected"), tokens sealed, refresh works
      across two worker replicas (one refresh, shared lock).
- [ ] Start-up refuses a wrong binding (live id under `test_org`, Bid id under Shop).
- [ ] Daily call budget and rate window shared across replicas (metric shows one budget).

**Bid (London Auction Xchange test organisation)**
- [ ] Lot sold, invoice raised: contact + invoice in Books, totals equal to the penny, LAX's PDF copy stored.
- [ ] Card payment: customer payment into Stripe clearing, applied in full.
- [ ] Pay several (one charge, several lots): one payment applied to each invoice exactly.
- [ ] Bank transfer, part funded then fully funded: nothing booked until fully funded; then one payment.
- [ ] Full and partial refund: credit notes with per-line VAT equal to Books', refund from clearing once.
- [ ] Refund reversed after its credit note: held for a person with the alert.
- [ ] Buyer default on a sent invoice: credit note cancels it (D5); an unsent invoice is voided instead.
- [ ] Payment after the default: a new invoice for the same lot, payment applied to it (D5).
- [ ] Bank-transfer refund: only to the source account; direct bank refund needs two different staff (D5).
- [ ] Seller payout made and paid: bill and bill payment (or parked with the right reason while C3 is open).
- [ ] Duplicate guard: resend the same document (kill the worker mid-send): Books holds one document,
      LAX adopts it.
- [ ] Read-back mismatch held for a person (edit a document in Books by hand, run the status check).

**Shop/Art (London Art Exchange test organisation)**
- [ ] Paid order (edition, framing, UK delivery): invoice under its `LAX-INV-` number + payment.
- [ ] Order with delivery outside the UK: delivery invoice parked (or booked, once C5 is answered).
- [ ] Line refund and whole-order refund: credit notes, refund from clearing.
- [ ] Original sold directly: Payment Link → paid → Books invoice in the Shop's numbering.
- [ ] Artist payout paid: vendor contact, bill, bill payment (or parked while C4 is open).

**Both organisations**
- [ ] Stripe fees as expenses and a Stripe payout as a transfer from clearing to the bank; the daily
      reconciliation report shows no mismatch for 5 consecutive days.
- [ ] Nightly status check reads every issued document back; a Books notice for a payment recorded
      by hand opens a finance task and applies no money.
- [ ] Locked period: a document dated in a locked period waits for a person.
- [ ] Rate limit and budget exhaustion: documents requeue and are sent after the wait, none lost.
- [ ] Q-ROUNDING case confirmed (3p of a 25p line).
- [ ] Every "to confirm in the test organisation" item of `packages/accounting-zoho-books/README.md` ticked.
- [ ] Alerts and cron monitors fire and resolve (Sentry), Failed jobs shows Books rows.
- [ ] **With `XERO_API_WRITES_DISABLED=true` on test for the whole proof window**, every flow above still
      works and no LAX screen or job errors: this proves nothing on test needs Xero before it is deleted.
- [ ] The accountant has reviewed both test organisations' ledgers and VAT reports and signed off in writing.

## 6. PR plan (in order)

Each PR is small enough to review alone, keeps `main` releasable, and lists its acceptance. "Fake"
means the in-memory fake and `SimulatedBooks`; no PR before B1 reaches Zoho.

| # | PR | Needs | Scope | Acceptance |
| --- | --- | --- | --- | --- |
| 1 | **Go-live runbook, retire the history import** | A | Delete `books:import-shop-history` and its service, reader and tests; strip the Xero cutover instant from `books:backfill`; replace `docs/runbooks/zoho-books-cutover.md` with `zoho-books-go-live.md`; update `monitoring-alerts.md`. | No reference to the import remains; backfill tests pass without `--not-before`; runbook names no Xero step. |
| 2 | **Books-only source switch** | A | `booksTargetMode` / `documentTarget` and the Shop reader (`drizzle-order-invoice-books.reader.ts`) stop reading `xero_mode`; Books target decided by `books_mode` alone. | Projector, sender, Shop originals and backfill suites pass with `xero_mode` ignored; no behaviour change while Xero is still live on test (Books not live). |
| 3 | **Books token store and connect flow** | A | `DrizzleZohoTokenStore`, OAuth connect/callback routes (staff, step-up), connection status card on Finance › Accounting. | Contract suite runs against the store; connect flow tested with a fake Zoho accounts host; no token is ever logged or stored unsealed. |
| 4 | **Books PDF fetch** | A | Binary transport in the client, `adapter/pdf.ts`, contract test on the simulator. | `runDocumentPdfContract` passes for the HTTP adapter; LAX copy stored for an issued invoice and credit note. |
| 5 | **Compose the HTTP adapter for `test_org` and `live`** | A | `createBooksAccountingAdapters` builds the HTTP adapter per bound mode with the Redis-backed client; `BOOKS_ORGANISATIONS` still empty. | With the binding empty, `byMode` holds only `dry_run` behaviour in practice (sender refuses unbound modes); unit tests with a bound fake show sends go only to the bound organisation. |
| 6 | **Buyer default by credit note, void only if unsent** (from #1576) | A (D5) | `BID_DEFAULT_ACCOUNTING_TREATMENT = "credit_note"`, forward migration lifting the 0385 release guard, `checkVoid`. | Default on a sent invoice yields one credit note for the full gross; unsent yields a cancel; tests on the fake. |
| 7 | **Re-invoice after a credit note** | A (D5) | `bid_invoice.follows_invoice_id` migration, Bid admin "Re-invoice" action, projection. | Late payment lands on the new invoice; the cancelled one stays credited; audit trail. |
| 8 | **Refund to source, two-person bank refunds** | A (D5) | Refuse unknown-source bank-transfer refunds; `direct_bank_refund` table, request/approve screens, Books recording against the credit note. | Same person cannot approve; refund destination locked; recorded once in Books. |
| 9 | **Buyer invoice from Books copy, not Xero** | A | Presenter and pages read `accounting_document_copy`; Xero URL/number no longer shown. | Buyer pages show LAX's Books copy; no Xero field read by any buyer page. |
| 10 | **Bind the test organisations** | B | `BOOKS_ORGANISATIONS.test_org` ids, `ZOHO_BOOKS_ORG_CONFIG_TEST` validated, infra variables, connect both organisations. | Worker starts on test with both bindings; Finance › Accounting shows both connected. |
| 11 | **Real-Books fixes from the test organisation** | B | Mapper and classifier fixes for whatever item 4 of B finds; README "to confirm" list closed. | Contract suite updated to the confirmed shapes; one document of every kind issued on test. |
| 12 | **End-to-end proof on test** | B | Run section 5 with `XERO_API_WRITES_DISABLED=true` on test; evidence under `docs/pr-evidence/books-test-proof/`. | Every box in section 5 ticked; accountant sign-off recorded (no personal data). |
| 13 | **Accountant answers** (one PR per answer, any order) | C | C1–C9 code changes listed in section 2C. | Parked documents of that kind rebuild and issue on test; tests pin the treatment. |
| 14 | **Xero removal X1: stop writing** | After 12, X0 done | Section 4.12 X1. | As X1. |
| 15 | **Xero removal X2: stop reading and showing** | After 14 is released | Section 4.12 X2. | As X2. |
| 16 | **Xero removal X3: drop the schema** | After 15 is released | Section 4.12 X3. | As X3. |
| 17 | **Xero removal X4: config, dependencies, docs** | After 16 is released | Section 4.12 X4. | As X4. |
| 18 | **Go-live on production** | C1, C2, C8, C9, after 17 | Live organisations created and bound (`BOOKS_ORGANISATIONS.live`), production secrets and infra variables, both products `off → live` on the agreed date. | First live Bid invoice and Shop invoice issued and checked by the accountant; reconciliation clean for the first week. |

Removal (14–17) goes before production go-live so that production never runs Xero and Books side
by side, and launches with Books only (D2). This assumes production has not launched with Xero
writing real records. If it has, PRs 14 and 18 must ship in the same release (Books `live` the moment
Xero writes stop), and the exports in section 4.3 are mandatory before PR 16.

PRs 1–9 are independent of each other except 5 (after 3 and 4) and 7 and 8 (after 6), and can be
reviewed in parallel. PR 13 can land at any point; each answer's documents stay parked until it does.
