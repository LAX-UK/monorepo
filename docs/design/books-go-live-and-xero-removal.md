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

INVENTORY_PLACEHOLDER

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
| 14–17 | **Xero removal** (section 4 steps X1–X4) | After 12 | One PR per removal step, in order. | Each step's acceptance in section 4; `git grep -i xero` is empty at the end except the historical migrations and this document. |
| 18 | **Go-live on production** | C1, C2, C8, C9, after 17 | Live organisations created and bound (`BOOKS_ORGANISATIONS.live`), production secrets and infra variables, both products `off → live` on the agreed date. | First live Bid invoice and Shop invoice issued and checked by the accountant; reconciliation clean for the first week. |

Removal (14–17) goes before production go-live so that production never runs Xero and Books side
by side: until PR 18 production keeps whatever Xero does today, and the switch to Books live is the
last change.
