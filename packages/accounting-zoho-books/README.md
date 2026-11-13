# @auction/accounting-zoho-books

The Zoho Books HTTP client and the Books adapter for the Xero → Zoho Books move. The client sends
requests and says, in typed errors, what happened. The adapter (`src/adapter`) implements the
`@auction/accounting-domain` ports on top of it. At runtime the worker uses only the rehearsal adapter
(`createBooksAccountingAdapters` in `@auction/finance-runtime`); the HTTP client and the writing adapter are
not wired yet, and no test touches the network.

Depends on `@auction/accounting-domain` (outcome types) and `@auction/identity-contracts` (the token
envelope). `lint:layers` forbids anything else in the workspace, apps, the database and frameworks.

## What it does

| Concern | Where | Rule |
| --- | --- | --- |
| Data centre | `config.ts` | EU only: API host `books.zoho.eu` or `www.zohoapis.eu`, accounts host `accounts.zoho.eu`, https, no port or credentials. Anything else fails at start-up, so a token can never be sent elsewhere. |
| Tokens at rest | `token-sealer.ts`, `token-manager.ts` | Refresh and access tokens are sealed with the same AES-256-GCM `v1:` envelope as Xero's (#1299). The key (`ZOHO_BOOKS_TOKEN_DEK_KEY`) is required: no key, no client. A value that is not an envelope is refused, never read as plaintext. Table: `zoho_books_connection` (migration 0369). |
| Refresh | `token-manager.ts` | Single-flight per organisation; a refused refresh token marks the organisation `needs_reauth` and stops calls. The store's `saveRefreshed` and `markNeedsReauth` are compare-and-set on the `version` that was read, so a refresh that began before a reconnect cannot flag or overwrite the new connection. One attempt per refresh: after a timeout, a lost reply or a 5xx it is not repeated (Zoho may already have minted a token or rotated the refresh token); the next call re-reads the store first. The lifetime is read in seconds (`expires_in_sec`, or `expires_in` unless implausibly large, then milliseconds) and capped at 3600 s. |
| Limits | `gate.ts`, `call-budget.ts` | Per organisation: 100 requests a minute (sliding window), 5 in flight, and a daily call budget that stops hard (`budget_exhausted`, metric `zoho_books_daily_budget_exhausted_total`). A budget that cannot be read stops calls too. |
| Timeouts, retries | `client.ts` | A timeout per request. GETs retry on 429, 500/502/503/504, timeouts and connection failures; any other method retries only on 429. Backoff is exponential with jitter and honours `Retry-After`. A 401 gets one token refresh and replay. |
| Errors | `errors.ts`, `classify.ts` | `auth`, `rate_limited`, `validation`, `not_found`, `conflict`, `server`, `network`, `unknown`, `budget_exhausted`. Each carries `certainty`: `rejected` (Zoho did not act) or `unknown` (it may have: 5xx, timeout, reset, unreadable reply). Provider text is never copied into an error. |
| Domain | `outcome.ts` | `toIssueFailure` gives `rejected` / `unknown`; `toLookupFailure` reads absence only from a 404. After `unknown` the domain looks the document up by its LAX reference before any retry. |
| Logging | `redact.ts` | Request and response bodies and queries are logged through an allow list (opaque ids, amounts, dates, our own references); everything else, and anything that looks like a token, email or phone number, is replaced. Headers are never logged. |

## Tests and the harness

`@auction/accounting-zoho-books/testing` is for the adapter PR: `createClientHarness()` gives a client wired to a
`FakeZohoTransport` (scripted replies, an unscripted request fails the test), a `FakeClock` (`settle(promise)` runs
timers forward), an in-memory token store, a recording logger and metrics. `runZohoBooksClientContract` and
`CLASSIFICATION_CASES` pin how every reply is classified.

## Per process, not shared

Single-flight refresh, the per-organisation rate and concurrency gate (`gate.ts`) and the daily budget
(`InMemoryCallBudget`, the default) all live in one process's memory. With N worker replicas Zoho's
100-requests-a-minute limit and the daily budget become N times as large, refreshes are not
single-flight across processes, and a restart resets the day's count.

Design note for the runtime PR (which owns the wiring; nothing here changes):

- **Refresh lock.** Take a cross-process lock per organisation around "load, refresh, save": a Postgres
  advisory lock keyed on the organisation (`pg_advisory_xact_lock(hashtextextended(organization_id, 0))`
  in the store adapter's transaction) or a Redis lease. Under the lock, re-read the row first: if another
  process has stored a fresh access token, use it and send nothing. The `version` compare-and-set stays
  as the last line of defence.
- **Shared budget.** Implement `CallBudget` over the database or Redis with an atomic increment per
  organisation per day. It must reject when it cannot count (the client then fails closed).
- **Shared rate.** Either a shared counter for the 100-a-minute window or a per-replica share of it
  (limit divided by the replica count) until one exists.
- **No accidental default.** The runtime must pass an explicit `budget` in production; building the
  client with the in-memory one there is a bug.

## Not here yet

The shared budget, rate and refresh lock above, and a `ZohoTokenStore` adapter over `zoho_books_connection`
(its `version` can be the row's `updated_at`).

## The adapter

`createZohoBooksAdapter({ api, orgs, writes })` returns one port per document kind (`invoices`, `payments`,
`creditNotes`, `bills`), `contacts` (customers), `vendors` (payout recipients) and `lookup`. Each is its own
small class, so a caller depends only on the port it uses. `orgs` comes from `parseOrgConfigs`, which checks the
per-organisation settings when the process starts: the Books organisation id, whether it is a test or the live
organisation (required, no default), the custom field that carries the
LAX reference, whether the organisation is VAT registered (required, no default), tax ids per VAT treatment, item
and revenue account per line role, the Stripe clearing deposit account, the bill expense account, optional
templates and numbering groups. None of this is hard-coded in a mapper. An entity left out (Bid, until its
organisation exists) is refused with a clear reason.

| Concern | Where | Rule |
| --- | --- | --- |
| Writes | `adapter/write-gate.ts` | Dry-run by default: every create and update is refused with `zoho_books_writes_disabled` before any request (dependency lookups included). Writing needs `writes: { mode: "test_org" \| "live", organizationIds }`, and each id must be a configured organisation of that mode's kind: `test_org` only reaches organisations configured `environment: "test"`, `live` only `environment: "live"` (`write_allow_list_wrong_environment` otherwise), so the mode is never just a label. The API handed to the gateways also refuses POST/PUT to any organisation not on that list. |
| Rehearsal | `adapter/dry-run.ts` | `createZohoBooksDryRunAdapter({ orgs })` builds the exact request the Books adapter would (same organisation choice, dependency checks and mappers, so the same refusals) and sends nothing: it holds no HTTP client. A request that can be built is answered `issued` as `DRY-RUN` / `dry-run:<reference>` with our totals; the body is not kept (it carries personal data). Lookups find nothing. |
| One organisation per document | `adapter/api.ts` `orgFor`, `adapter/gateways.ts` `prepare` | The organisation is chosen once, from the product. A document whose `entity` disagrees, or that refers to a contact or invoice of another product, is refused (`zoho_books_entity_mismatch`) before any request. Every dependency lookup, the write and the duplicate-adopt lookup use that one organisation. |
| VAT registration | `adapter/org-config.ts`, `adapter/mappers/common.ts` | `vatRegistered` is stated per organisation. When false, no tax id may be configured or sent, and a line that carries VAT or claims the standard rate is refused (`zoho_books_mapping_vat_on_unregistered_entity`) and held for staff: never sent without its VAT, never sent with it. |
| VAT to the penny | `adapter/mappers/common.ts` `lineTax` | Books works VAT out per line from what we send; it cannot be handed our figure. A line is only sent when the VAT Books will compute (half-up, per line, inclusive or exclusive) equals the VAT LAX stated; otherwise `zoho_books_mapping_vat_differs_from_books`, nothing sent. Totals read back are still compared by the domain (a difference goes to review, never adjusted). |
| Translation | `adapter/mappers/*` | One pure mapper per document kind: the only code that knows Books field names. Lines go as quantity 1 and a two-decimal rate through one shared line rule (bills included); a line whose basis differs from the document's is refused. Every priced document and payment sends `currency_code`. No adjustment field is ever sent. |
| Customers and vendors | `adapter/mappers/contact.ts`, `adapter/resolve.ts` | Invoices, credit notes and payments go to a `customer` contact; bills only to a `vendor` contact (`vendors.upsertVendor`). A vendor's reference field holds the LAX reference with a `:vendor` suffix, because the field is unique across all contacts and one person may be both. A contact read back with the wrong type is refused. |
| Kinds | `adapter/kinds.ts` | One row per kind: path, list and item keys, id and number fields, how to read totals. A new kind adds a row. |
| Duplicate guard | `adapter/writer.ts` | Every document carries the LAX reference in a custom field Books refuses to accept twice. A create refused with one of the organisation's duplicate-value codes is looked up and adopted, so a repeat is the same document. The adapter keeps no state. |
| Read-back mismatch | `adapter/writer.ts`, domain `completeSending` | A payment Books made (fresh, or adopted after a duplicate refusal) that reads back different from what we sent is `differs` with Books' id, never `rejected`: the domain holds it for a person (`needs_review`, identity kept), even when the answer arrives after the lease, and it is never sent again. Contract fault `read_back_differs`. |
| Destination | `adapter/api.ts` `booksDestination`, `adapter/destination-binding.ts` | Every adapter says where it would call (`destination.destinationFor(product)`): the Books adapter the organisation `orgFor` chooses, the dry run none at all. `parseBooksDestinationBinding` reads the per-mode binding and refuses at start-up an id that is not the product's configured organisation, or not of that mode's environment, so the live organisation can never be bound to `test_org`. |
| Payments read back | `adapter/gateways.ts` `paymentMatches`, `adapter/writer.ts` | A payment (fresh or adopted) is only accepted when Books holds the same customer, amount, currency, date and amount applied to each invoice. Otherwise the answer is `differs` (reason `zoho_books_payment_mismatch`) with Books' identity and totals: the document exists, so it goes to a person and is never retried. The same holds for a new contact that reads back as the wrong type. |
| Lookup | `adapter/lookup.ts` | Searches the kind's collection by the custom field, then reads the document and requires the stored reference to equal the one asked for, so a filter Books ignored can never adopt another document. Absence is only an empty search or a 404. |
| Dependencies | `adapter/resolve.ts` | A contact or invoice we refer to is found by reference in the document's organisation. Missing is a rejection; not confirmable is `unknown`. |
| Totals | `adapter/kinds.ts` | Books' sub total, tax and total are read back as whole pence (a fraction of a penny is `unknown`). The domain compares them with ours; a difference goes to review. |

Every reason the adapter itself refuses with is in `ZOHO_BOOKS_REJECTIONS` (`adapter/rejections.ts`).

`@auction/accounting-zoho-books/testing` adds `InMemoryAccounting` (the fake), `SimulatedBooks` (Books at the
HTTP edge, with the unique reference field, per-line tax, per-organisation taxes, contact types, required currency
and injectable faults) and `runAccountingContract`, one suite run against both the fake and the real client and
adapter over the simulator. The fake refuses with the adapter's own reasons, so tests written against it see what
they would see against Books. In the fixtures London Art Exchange is not VAT registered (as in Books); the Bid
organisation is modelled as registered only so the VAT paths have an organisation to run against.

## Open questions for the owners and accountant (Books stays dry-run until answered)

- **Is London Auction Xchange LTD (Bid) VAT registered?** Its Books organisation does not exist yet. The adapter
  takes the answer from `vatRegistered` in its organisation settings and has no default; until it is set, Bid
  cannot be configured at all.
- **What VAT should Shop / lax.art documents carry?** London Art Exchange Ltd is not VAT registered in Books, but
  the domain builders still produce standard-rated lines for Shop. Every such document is refused by the adapter
  (`zoho_books_mapping_vat_on_unregistered_entity`) and held for staff. Which treatment Shop lines should use is a
  domain decision, not something the adapter changes.
- **Partial credits whose VAT Books rounds differently.** The domain allocates credit VAT cumulatively; Books
  rounds each tax-inclusive line on its own. About 1 partial credit in 9 differs by 1p, and those are refused
  (`zoho_books_mapping_vat_differs_from_books`). Options: confirm in the test organisation whether Books accepts a
  line-level tax amount (then send ours), or align the domain's allocation with Books' rule, or accept these going
  to staff.

Still to confirm in the Books test organisation before any live send: that list endpoints filter on the
custom field, the duplicate-value code, the field names read back for credit notes and payments
(`invoices[].amount_applied`, `currency_code`, `date`, `customer_id`), `contact_type` on a contact read back,
that a bill to a customer contact is refused, how Books rounds tax on tax-inclusive credit lines, and applying a
credit note to its invoice.
