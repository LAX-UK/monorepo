# Review: PR #1356 — Zoho Books: Bid invoices (rehearsal)

Independent money, security and UI review of branch `bk7-bid-invoices-books` at `699176c9` (Zoho Books plan v2, PR 7; migration 0381). Main was at `a01e614b` when reviewed, and the branch already contains it.

## How it was checked

- `corepack enable && pnpm install --frozen-lockfile && pnpm -r --filter './packages/**' build`: ok.
- A throwaway Postgres 16.15 cluster (initdb under `/var/tmp`, port 55432). `db:migrate` and `db:roles` were applied to a fresh database.
- Migration pair 0381: rollback, then forward, then rollback, then forward again on a copy of the migrated database. All four steps ran cleanly.
- Tests, in small batches with `--maxWorkers=2`:

  | Area | Result |
  |---|---|
  | worker (7 files) | 51 passed |
  | api (3 files) | 135 passed |
  | accounting-domain | 219 passed |
  | accounting-zoho-books | 286 passed |
  | email | 233 passed |
  | types | 323 passed |
  | persistence books/accounting | 57 passed |
  | db roles | 58 passed |
  | `shop_app` role contract (with a shop URL) | 13 passed |
  | web (4 files) | 20 passed |

  The integration suites ran against the real database; they were not skipped.
- `pnpm lint:layers`: ok, no layering violations. `biome check` on the changed files: clean.
- New concurrency tests on real transactions: `tests/review1356.integration.test.ts` on this branch. It is meant to sit next to `bid-invoice-books.integration.test.ts` and was not pushed to the PR. It has three tests:
  1. Six copier instances tick at the same moment against the real email outbox (`PostmarkEmailService` on the worker role). Exactly two outbox rows result (payer and billing inbox), there are two distinct queue job ids, and the copy is marked once. **Passes** (three runs in a row).
  2. Six concurrent projections of the same `invoice.raised` event produce one Books document, with "created" counted once and no errors. **Passes.**
  3. Head-of-line blocking, as described in F1. **Passes, which confirms the defect.**
- Mutation tests. Each mutation was applied, the listed tests were run, and the file was restored. The working tree was confirmed clean afterwards.

  | # | Guard reverted | Result |
  |---|---|---|
  | M1 | Per-document email idempotency key (made unique per call) | killed (concurrency test and the unit test fail) |
  | M2 | Line-change refusal (`sameLines`) | killed |
  | M3 | `documentId` must match this invoice's documents | killed |
  | M4 | `paymentRole === "payer"` in `findPayersInvoice` | killed |
  | M5 | `memberIsPayer(actor)` | killed |
  | M6 | `!copy.rehearsal` in `servable` | **survived** |
  | M7 | `targetMode !== "dry_run"` in `servable` | **survived** (M6 and M7 each mask the other in the fixtures) |
  | M8 | Cancelled invoice refuses document download | **survived** |

- UI: there is no `review-notes-pr1356` screenshot branch on the remote, so the UI was judged from the code, the view-model and the component tests only (see F11).

## What meets the owner's rules

- **Dry run.** Books stays in dry run. The dry-run adapter sends nothing out, and in dry run the stored PDF is a stand-in page titled "REHEARSAL - not a Zoho Books document". That page holds only the LAX reference (product, kind and a uuid), `DRY-RUN` and the totals: no names, emails or addresses.
- **No email in dry run.** Three guards block it: the service (`modes.some(m => m !== "dry_run")`), the query (`rehearsal = false` and mode in test_org/live) and the table CHECK. The integration test asserts that nothing is enqueued.
- **Test organisation gate.** The test_org destination stays bound to the organisation id through the existing `DestinationBinding`.
- **VAT and ARR.** No VAT was added on the premium or ARR lines. `BID_LINE_BOOKINGS` treatments are unchanged. ARR, VAT on hammer, import VAT and delivery are refused with `line_awaiting_accountant`.
- **Premium never recomputed.** The premium is booked from the frozen line's label and amount. A test proves that a premium which is not 25% of the hammer is booked as stored.
- **Outbox event.** `invoice.raised` is written in the raiser's transaction. Its payload is ids only (the invoice, lot and legal entity, the total, the raise time and the line ids). A failed raise leaves neither the invoice nor the event.
- **Projector.** Projection is idempotent (unique on product, entity, reference, provider and mode; replays are recognised). It is also idempotent under concurrency (my test 2).
  - When Books' total differs from LAX's, the invoice goes to `needs_review` with Books' figure kept.
  - When an invoice's lines differ from the ones the event names, the projector refuses without retrying (`retryable = false`) and the event goes to failed deliveries.
- **Money.**
  - Every figure comes from `bid_invoice.total_pence` or the frozen lines.
  - An invoice is only marked `issued` when Books' totals equal LAX's. A mismatch holds it for a person.
  - Formatting uses integer pence divided by 100 with `toFixed(2)`, in GBP.
  - No double booking: one document per mode, confirmed under concurrency.
- **Buyer downloads.** The buyer downloads only LAX's stored copy:
  - The bytes are streamed through the API; there is no signed URL and the storage key is never sent to the browser.
  - Keys are `accounting/<LAX company>/<document uuid>.pdf`.
  - Responses carry `nosniff`, a sanitised file name and `no-store`.
- **Who can read.**
  - Only the payer (their own account, or an organisation member with the payer role) can read the card or a document.
  - A `documentId` must belong to that lot's own invoice for the current mode. A missing lot, someone else's lot and a foreign document all return the same 404 `invoice_not_ready`.
  - View-as staff reach these routes as GETs through the existing impersonation context, so they are read-only.
- **Grants.** Migration 0381 is next after main's 0380 and is in the journal.
  - `worker_app` has INSERT and SELECT, plus UPDATE on `email_queued_at` and `email_outbox_id` only.
  - `api_app` has SELECT only.
  - `shop_app` and `auth_app` have nothing, verified with `has_table_privilege`.
- **Approved copy.** The approved wording for preparing, delayed, issued, cancelled, "PDF available once issued" and the email subject `Your invoice [number] from LAX Bid` is used verbatim.
- **Architecture.** The PDF is a domain port (`DocumentPdfPort`) with Zoho, dry-run and fake adapters and a contract test. Readers live in persistence and services in apps. `lint:layers` passes.

## Findings

### F1 — High — The invoice email queue can stall for good behind invoices it will never email

`AccountingInvoiceCopy.sendEmail` returns `false` without marking the copy when the invoice is cancelled or has no payer:

```ts
if (!facts?.payer || facts.cancelled) return false
```

`listEmailDue` takes the oldest `batch` (10) rows where `email_queued_at IS NULL`, ordered by `stored_at` ascending. Rows skipped for a bad reference or a null number also stay in the window.

- **Failure:** once 10 issued invoices are later cancelled (or lose their payer row), they fill the head of the queue on every tick, and no later invoice is ever emailed.
- **Silent:** nothing logs this, and the delayed alert only counts invoices that are not yet issued.
- **Reproduced:** my test 3 uses a batch of 1. A cancelled invoice issued first holds back a valid invoice behind it for three ticks, with zero enqueues.
- **Impact today:** none, because dry run never emails. It becomes live the moment test_org or live is used.

**Fix:** settle every listed row in one of two ways:
- Add a terminal column (for example `email_skipped_at` with a reason, or reuse `email_queued_at` with a null outbox id under a relaxed pair CHECK), so skipped invoices leave the due list.
- Or filter them in the query: join `bid_invoice` with `voided_at IS NULL`, and require a payment row.

Then log a warning with the document id, and add a regression test like test 3.

### F2 — Medium — The invoice email goes to whoever made the last payment, even if they have left the account

`DrizzleBidInvoiceEmailFactsReader` names the payer as `payment.buyerId` of the latest payment, joined to the identity directory. It does not check that this person is still a member of the buyer organisation with the payer role. The download routes do check this (`memberIsPayer` and `paymentRole === "payer"`).

**Failure:** a member checks out for an organisation and is then removed before Books issues the invoice. This can be hours or days later if the invoice sat in `needs_review`. That former member still receives the organisation's invoice PDF as an attachment.

**Fix:** in the facts reader, for an organisation buyer, require a current active membership with a payer role. Otherwise, send to the billing inbox only (or to the account's current payers). Add a test for the "member removed" case.

### F3 — Medium — test_org is treated as a real invoice for real buyers

`invoiceStanding` and the email path treat `test_org` like `live`.

- **Today:** `ZohoDocumentPdfGateway` always returns `unavailable`, so if the Bid switch is ever set to `test_org` on production:
  - every buyer's card shows "This is taking longer than usual. Our team has been told."
  - `accounting.bid_invoice_delayed` fires for every invoice.
- **Once the PDF gateway is built:** real buyers would be emailed "Your invoice INV-…" for documents in the test organisation, which are not tax invoices.

**Fix:** until there is an owner decision, treat `test_org` like `dry_run` for anything buyer-facing:
- the standing returns `lax`;
- the email query becomes `targetMode = 'live'`.

If test_org must reach people, gate it on an explicit allow-list of test buyer accounts.

### F4 — Low — "Issued [date]" comes from the row's `updated_at`, not from the issue

`PurchaseInvoiceBooksService.card` sets `issuedAt: document.updatedAt`.

**Failure:** any later write to the document row (a requeue tool, a repair, or future reconcile columns) changes the "Issued" date the buyer sees.

**Fix:** use the `occurred_at` of the `accounting_document_event` whose `to_state = 'issued'`, or Books' own `date` stored on `IssuedDocument`.

### F5 — Low — Credit notes are shown and served from data that never exists, with copy that was not approved

- **No copies:** `listUncopied` only selects `kind = 'invoice'`, so no credit note ever gets a stored copy. `servable(note)` is therefore always false, and the credit-note list and download are dead code.
- **Unapproved copy:** the strings "Refunded −£…" and "Download credit note … (PDF)" are not in the approved copy.
- **Hidden after cancellation:** credit notes are only listed when the invoice is `issued`, and the document route refuses any cancelled invoice. A credit note raised because an invoice was cancelled can therefore never be shown or downloaded.

**Fix:** either remove the credit-note branch from this PR, or copy credit notes too. If kept, get the copy approved, and decide (with the owner) whether a cancelled invoice still offers its credit note.

### F6 — Low — Error responses from the document routes: caching and status

- **No `no-store` on errors:** API `GET /purchases/:lotId/documents/:documentId` only sets `Cache-Control: no-store` on success; a 404 or 403 can be cached by an intermediary. The web route copies the API status through, so a non-payer role gets 403 while a missing document gets 404. The comment says the answer is "the same for every reason". This does not leak whether a lot exists, because the role check runs before any lookup, but the comment and the behaviour disagree.
- **Card errors:** the card route sets the header before `respond`, which is fine.

**Fix:** set `no-store` before the error branch. Either map every non-200 in the web route to one 404, or correct the comment.

### F7 — Low — The "never email a rehearsal" CHECK constrains the record, not the send, and "once only" relies on application code

- **The CHECK does not stop an email:** the email is enqueued before `markEmailQueued`. If the service and query guards were both broken, the CHECK would only reject the mark: the mail would already be in the outbox, and every tick would retry it (the idempotency key still keeps it to one).
- **Once only is not enforced by the table:** `worker_app` can UPDATE `email_queued_at` back to NULL; no trigger stops it.

**Fix:**
- Describe the CHECK accurately in the comments and the runbook.
- Optionally add a trigger making `email_queued_at` and `email_outbox_id` write-once, from NULL to a value and never back.

### F8 — Low — The stored-attachment guard accepts any storage key, for any template

`storedEmailAttachments` validates the key's characters but not its prefix, and it ignores `_template`.

**Fix:** require `storageKey` to start with `accounting/` and end in `.pdf`, and only honour `storedAttachment` for `bid-invoice-issued`. This is cheap defence in depth, so that a future template cannot attach an arbitrary stored upload.

### F9 — Low — Test gaps (mutations that survived, and missing cases)

- **M6 and M7 survive:** add a service case with `test_org` and a copy with `rehearsal: true`, and a case with `dry_run` and `rehearsal: false`. Each must be refused on its own.
- **M8 survives:** add a case where the document is downloaded for a cancelled (voided) invoice and expect 404.
- **No foreign-document test:** add an explicit case where the `documentId` belongs to another invoice and another account, and expect 404 without any storage read.
- **No concurrency coverage in the suite:** adopt the attached concurrency tests 1 and 2, and test 3 inverted once F1 is fixed.

### F10 — Info — The Drizzle schema has one of the migration's five CHECKs

`accountingDocumentCopy` in `schema/accounting.ts` declares only `no_rehearsal_email_ck`. These four are in the SQL but not in the schema:
- `content_type_ck`
- `size_ck`
- `sha256_ck`
- `email_pair_ck`

A later `drizzle-kit generate` may try to drop them. **Fix:** declare all five in the schema.

### F11 — Info — UI was judged from code only

There is no `review-notes-pr1356` screenshot branch.

- **Copy and structure:** the view-model copy matches the approved wording exactly. The card uses `lax-*` tokens, so dark mode follows the theme. The delayed state uses `<output>` (it is announced) with warning tokens, and icons are `aria-hidden`.
- **Not verified:** light, dark and 375px layouts, and how a long invoice number wraps.
- **Dates include a time:** "Issued Thu 12 Nov, 14:05 GMT" and "cancelled on Thu 12 Nov, 14:05 GMT" show a time, while the approved copy says "[date]". Confirm with the owner that this is wanted, or format the date only.

**Fix:** upload screenshots of preparing, delayed, issued and cancelled (plus the unchanged LAX state), each in light, dark and at 375px, before merge.

## Severity table

| # | Severity | Area | Summary |
|---|---|---|---|
| F1 | High | Email | Cancelled or payer-less invoices at the head of the queue stall all later invoice emails, silently |
| F2 | Medium | Security / email | The invoice PDF is emailed to the last payer even if they are no longer a member with the payer role |
| F3 | Medium | Rules / UI | test_org is buyer-facing as if live: delayed card and alerts today, test-org invoices emailed later |
| F4 | Low | Money / UI | "Issued" date comes from the row's `updated_at` |
| F5 | Low | UI / money | The credit-note path is dead (no copies), its copy is unapproved, and it is hidden after cancellation |
| F6 | Low | Security | `no-store` missing on error responses; the web route's status contradicts its comment |
| F7 | Low | Email / DB | The CHECK guards the record, not the send; `email_queued_at` is not write-once |
| F8 | Low | Security | The stored-attachment key is not limited to `accounting/` or to this template |
| F9 | Low | Tests | M6, M7 and M8 survived; no foreign-document test; no concurrency tests in the suite |
| F10 | Info | DB | The schema has 1 of the migration's 5 CHECKs |
| F11 | Info | UI | No screenshots; dates show a time where the copy says [date] |

### Verdict: FIX FIRST
