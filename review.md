Verdict: SHIP

# Review of PR #1572: accounting and private-deal audit fixes (F17, F18, F19, F20, F22)

Reviewed head `dcd1c832` (4 commits on `33ca431d`) against what `findings.md` on
`review-notes-systems-final-audit` asked for. Nothing blocks. I found no defect in the money
logic. The notes below are small and can follow later.

## Test and typecheck runs (local, head `dcd1c832`)

| Suite | Result |
|---|---|
| accounting-domain | 21 files, 428 passed |
| accounting-zoho-books | 17 files, 362 passed |
| finance-runtime | 261 passed, 4 skipped (the Redis integration test with no `REDIS_URL`) |
| finance-runtime `src/books` with `REDIS_URL` (throwaway redis-server) | 43 passed, including `redis-zoho-books-limits.integration.test.ts` (4) and the new `create-zoho-books-client.test.ts` (2) |
| domain | 3956 passed, 1 skipped |
| api (`--maxWorkers=2`, Postgres 16 on 55432, migrated) | 8025 passed, 1 skipped, 1 failed |
| web, private-sales and http schema tests | 60 files, 332 passed |
| `turbo run typecheck` | 88/88 tasks pass |

The one api failure is `seller-proceeds/record-signed-agreement.integration.test.ts`. It fails
with `role "api_app" does not exist`, and then `permission denied for table lot`, because the
throwaway database has no roles or grants (those come from `migrate-prod`/`migrate-roles`).
The PR does not touch that file or its code path. This is an environment problem, not a PR
problem.

I also checked these by hand:
- **Type level (F17).** A temporary file compiled under the package's tsc with `@ts-expect-error`
  confirms three constructions fail to compile: `new ZohoBooksClient` with no limits, with only
  budget and rate window, and with a forged `inProcessLimits: Symbol()`. I deleted the file
  afterwards.
- **Runbook SQL.** Both new runbook queries run against the migrated schema.
  `accounting_document.kind/payload` exist and `creditVatRule` is a top-level payload key
  (`persistence/src/lib/accounting-document-payload.ts:158-161`).
  `private_sale_deal.reference/stage/updated_at/invoice_reference` also exist.

## F17: Books client requires the shared Redis ports. Done.
- `packages/accounting-zoho-books/src/client.ts:92-93`: `ZohoBooksClientDeps` is
  `Base & (ZohoBooksSharedLimits | ZohoBooksInProcessLimits)`. The shared variant needs all
  three ports. The in-process variant needs the unique-symbol marker, which only
  `inProcessZohoBooksLimits()` produces. That function is exported only from `./testing`; the
  main index exports only the types (`src/index.ts:8`).
- `client.ts:131-135`: the runtime guard throws `zoho_books_shared_limits_required` unless all
  three ports are present or the real marker is set. A forged symbol is refused
  (`shared-limits.test.ts:51-67`).
- `packages/finance-runtime/src/books/create-zoho-books-client.ts:27-30`: the single factory
  always passes `redisZohoBooksLimits`. Its tests show Redis is consulted before any send, and
  that it fails closed when Redis is down.
- **Nothing wires Books live.** `createZohoBooksHttpClient` has no caller outside its own test
  and the package index. No `new ZohoBooksClient` exists outside the factory and `src/testing/*`.
- **Dry-run adapter unchanged.** The adapter construction files are not in the diff.

Non-blocking note: nothing stops production code from importing
`@auction/accounting-zoho-books/testing` and calling `inProcessZohoBooksLimits()`. The guard is
by convention plus code review. A lint rule banning `/testing` imports outside test files would
make it mechanical.

## F18: split cap. Done; totals reconcile.
- `packages/accounting-domain/src/document.ts:926-935` with `creditFor` at `:974-982`:
  1. Build with unlimited splits.
  2. If the note is over `MAX_LINES`, build it unsplit.
  3. Rebuild with a spare-line budget of `MAX_LINES - unsplit.length`.

  `creditLines`/`replayedSplit` are pure: they work on copies (`:709-742`), so calling
  `creditLines` again unsplit after a split that does not fit leaves no partial ledger state.
  A split only replaces one credit line with parts whose gross equals `take` and whose VAT
  equals the single line's VAT (`:699`), and each part is replay-checked. So a capped note has
  the same gross and VAT as the unsplit one. The cap cannot over-credit.
- Table tests (`document.test.ts:1033-1091`) cover 10 lines with 10 splits, 999+1 (exactly at
  the cap), 995 lines with 10 wanted and 5 kept, and 1000 lines with 0 kept. Each case asserts
  the line count, that VAT summed over every note equals the invoice VAT, and that every line
  is credited exactly 25p gross.
- Runbook line is present: `docs/runbooks/zoho-books-cutover.md:234-244` ("forward-fix only,
  never revert after the first Books-rule note"), with a working detection query.

Non-blocking (doc accuracy): `creditFor` is greedy, not a hard stop. When a split needs more
spare lines than are left, it is skipped, but a later line whose split needs fewer can still be
split (MAX_SPLIT_PARTS = 3, so a split can add 1 to 3 lines). The docs at `document.ts:869-871`
and `:960-961` say splitting "stops at the cap", and the README says "splitting stops at the
cap". The behaviour is safe: the note stays at or under the cap, and every split reconciles.
Either reword the docs to "only splits that fit", or `spare = 0` after the first skip. All the
test fixtures use 1-extra-line splits, so this mixed case has no test.

## F19: README. Accurate.
- `packages/accounting-zoho-books/README.md:110-135` now opens with the unconfirmed half-up
  assumption. It drops "every partial credit matches Books" and lists the three cases that can
  differ (clamped partials at about 0.75%, small rests or drift, and lines after the split cap).
  It states that they go to staff with exact totals. `vatInsideGross`, `creditVat`
  (`document.ts:620`), `creditLines` and `adapter/mappers/credit-note.test.ts` all exist. The
  accountant confirmation is still listed as required before go-live. That part of F19 is a
  person's task, not code.
- `README.md:46-52`: the limits paragraph matches the code
  (`zoho_books_shared_limits_required`, `createZohoBooksHttpClient`, `inProcessZohoBooksLimits`
  from `/testing`).

## F20: issuer call inside the move to Invoiced. Done; atomic.
- `apps/api/src/services/private-sale-deal/deal-invoice.service.ts:67-84`: one
  `runInTransaction` does three things:
  1. Runs `transitions.transition(..., scope)` with the tx-bound scope. The scope parameter is
     honoured and no nested transaction is opened (`deal-transition.service.ts:96-102`).
  2. Calls the issuer.
  3. Records the reference through `DrizzlePrivateSaleDealFinanceStore(tx)`
     (`container/create-private-sale-deal-services.ts:185-189`).
- When the issuer returns null, a blank reference, or throws, or the deal lacks invoice terms,
  `raise()` (`:98-111`) throws `InvoiceNotIssued`. That rolls back the stage change, its history
  row and the outboxed event (`events.withTx(tx)`). The caller gets the typed
  `{kind:"blocked", blockers:[{code:"invoice_not_issued"}]}`, and the copy is in
  `packages/domain/src/private-sale-deal/blockers.ts:80-81`.
- A failure to record the reference also rolls back and rethrows (test at
  `deal-invoice.service.test.ts:133-140`).
- The old path that could leave the deal Invoiced without a reference is gone. That path was
  the old `catch` that "keeps the deal invoiced", plus the early return when terms were
  missing.
- **Audit trail.** A successful move keeps its history row and event in the same transaction.
  A refused attempt leaves no history (it was rolled back) and only the
  `private_sale_invoice_not_issued` log line (`:89-95`). That is consistent with "no partial
  state".
- **Concurrency.** A second concurrent issue reaches the version CAS in `applyStageChange` and
  gets a non-ok outcome before `raise()` runs, so the issuer is not asked twice for one move.
- **Panel.** `deal-query.service.ts:298-304` adds the `invoice_issuer` gap. On the web, the
  change is one label in `POLICY_GAP_LABELS` (`private-sales.vm.ts:160`) and the zod enum
  (`admin-private-sales.schema.ts:199-206`). The panel reuses the existing `PolicyNotice`
  component and sentence pattern, with no new design.
- **Payouts and settlement unchanged.** No settlement, payout or payment service is in the
  diff. The container still passes those services the same `transitions` and `scopeForTx`.
- **Runbook.** `docs/runbooks/private-sale-deals.md:33-53` matches the code: it gives the
  blocker copy word for word, the notice wording and the idempotency requirement, and its
  pre-guard query is valid.

Non-blocking:
1. `apps/api/src/services/private-sale-deal/deal-query.service.ts:296-297`: two JSDoc blocks
   are stacked. The new method was inserted between `artworkOf` and its doc comment, so
   `artworkOf` lost its doc and `policyGaps` has two. Move line 296 down above `artworkOf`
   (now `:306`).
2. `apps/web/src/components/admin/private-sales/deal-sections.tsx:64`: the shared sentence
   reads "A real deal can't be **agreed** or invoiced until … invoicing for private sales … set
   up". A missing issuer blocks only invoicing, not agreeing. No issuer exists in any
   environment, so this warning now shows on every deal, including fully configured ones,
   where it says something slightly untrue. That is acceptable for now. Worth a wording
   tweak when PS-6 is decided.
3. The issuer is called inside the database transaction while it holds the deal's row lock.
   The PR documents this and requires an idempotent issuer. Whoever writes the first real
   `DealInvoiceIssuer` should also give it a bounded timeout. Nothing calls it today
   (`issuer: input.invoiceIssuer ?? null`, and no implementation exists).
4. `attachReference` is removed, so deals Invoiced before the guard with a null reference have
   no in-product route to attach one. The runbook leaves this to the owner (PS-6) and gives the
   query to find such deals. On the throwaway database that query returns 0 rows; production
   still needs it run.

## F22: design doc. Done.
- `docs/design/stock-location.md:38-39, 77-78` records `LAX_Location` as shipped in #1564 as a
  255-character text field, not a picklist, and still marks it "to confirm with owner", as the
  finding allowed.
