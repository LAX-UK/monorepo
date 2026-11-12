# @auction/accounting-zoho-books

The low-level Zoho Books HTTP client for the Xero → Zoho Books move. It sends requests and says,
in typed errors, what happened. It has no mappers (invoices, payments and so on are the adapter's
job), no apps wiring and no live calls in its tests.

Depends on `@auction/accounting-domain` (outcome types) and `@auction/identity-contracts` (the token
envelope). `lint:layers` forbids anything else in the workspace, apps, the database and frameworks.

## What it does

| Concern | Where | Rule |
| --- | --- | --- |
| Data centre | `config.ts` | EU only: API host `books.zoho.eu` or `www.zohoapis.eu`, accounts host `accounts.zoho.eu`, https, no port or credentials. Anything else fails at start-up, so a token can never be sent elsewhere. |
| Tokens at rest | `token-sealer.ts`, `token-manager.ts` | Refresh and access tokens are sealed with the same AES-256-GCM `v1:` envelope as Xero's (#1299). The key (`ZOHO_BOOKS_TOKEN_DEK_KEY`) is required: no key, no client. A value that is not an envelope is refused, never read as plaintext. Table: `zoho_books_connection` (migration 0369). |
| Refresh | `token-manager.ts` | Single-flight per organisation; a refused refresh token marks the organisation `needs_reauth` and stops calls. |
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

## Not here yet

A shared (multi-process) daily budget and a cross-process refresh lock: the ports (`CallBudget`, `ZohoTokenStore`)
are ready, the implementations belong with the runtime that wires them.
