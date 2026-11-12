# @auction/accounting-zoho-books

The Zoho Books HTTP client and the Books adapter for the Xero → Zoho Books move. The client sends
requests and says, in typed errors, what happened. The adapter (`src/adapter`) implements the
`@auction/accounting-domain` ports on top of it. Nothing calls either at runtime yet (no apps wiring,
Books mode stays off) and no test touches the network.

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

`createZohoBooksAdapter({ api, orgs })` returns one port per document kind (`invoices`, `payments`,
`creditNotes`, `bills`, `contacts`) and `lookup`. Each is its own small class, so a caller depends only on
the port it uses. `orgs` comes from `parseOrgConfigs`, which checks the per-organisation settings when the
process starts: the Books organisation id, the custom field that carries the LAX reference, tax ids per VAT
treatment (`standard` must have one), item and revenue account per line role, the Stripe clearing deposit
account, the bill expense account, optional templates and numbering groups. None of this is hard-coded in a
mapper. An entity left out (Bid, until its organisation exists) is refused with a clear reason.

| Concern | Where | Rule |
| --- | --- | --- |
| Translation | `adapter/mappers/*` | One pure mapper per document kind: the only code that knows Books field names. Lines go as quantity 1 and a two-decimal rate; credit lines are tax inclusive (gross as the rate, tax id of the line's treatment). No adjustment field is ever sent. |
| Kinds | `adapter/kinds.ts` | One row per kind: path, list and item keys, id and number fields, how to read totals. A new kind adds a row. |
| Duplicate guard | `adapter/writer.ts` | Every document carries the LAX reference in a custom field Books refuses to accept twice. A create refused with one of the organisation's duplicate-value codes is looked up and adopted, so a repeat is the same document. The adapter keeps no state. |
| Lookup | `adapter/lookup.ts` | Searches the kind's collection by the custom field, then reads the document and requires the stored reference to equal the one asked for, so a filter Books ignored can never adopt another document. Absence is only an empty search or a 404. |
| Dependencies | `adapter/resolve.ts` | A contact or invoice we refer to is found by reference. Missing is a rejection; not confirmable is `unknown`. |
| Totals | `adapter/kinds.ts` | Books' sub total, tax and total are read back as whole pence (a fraction of a penny is `unknown`). The domain compares them with ours; a difference goes to review. |

`@auction/accounting-zoho-books/testing` adds `InMemoryAccounting` (the fake), `SimulatedBooks` (Books at the
HTTP edge, with the unique reference field, per-line tax and injectable faults) and `runAccountingContract`,
one suite run against both the fake and the real client and adapter over the simulator.

Still to confirm in the Books test organisation before any live send: that list endpoints filter on the
custom field, the duplicate-value code, the field names read back for credit notes and payments, how Books
rounds tax on tax-inclusive credit lines, and applying a credit note to its invoice.
