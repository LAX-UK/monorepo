Verdict: SHIP

# Review of PR #1560: Private sales: refuse to invoice a deal while no invoice issuer is configured

Reviewed head `e1d70292` against `origin/main` `122b816a`. The PR branch was not changed.

## Was the problem real on main?
Yes. On main, `DealInvoiceService.issue` (apps/api/src/services/private-sale-deal/deal-invoice.service.ts:24-28) ran the
`issue_invoice` transition whatever the issuer was. With `issuer: null`, which production always has
(apps/api/src/container/create-private-sale-deal-services.ts:186, `input.invoiceIssuer ?? null`, and no caller passes one), it returned
`ok` with no reference. The old unit test even said so: "invoices the deal with no reference while no finance system issues invoices".

## Every path to `invoiced` is now guarded
- Domain: `issue_invoice` is the only command whose target is `invoiced` (packages/domain/src/private-sale-deal/transitions.ts:184).
- Every API caller of `transition(..., "issue_invoice")` goes through `DealInvoiceService.issue` (deal-invoice.service.ts:35). The staff
  `act` route sends `issue_invoice` there (deal-command.service.ts:164-170). No other caller exists in apps/api, apps/worker or the routes.
- Background jobs (reminders, payment and payout settlement, reversal) only move deals out of `invoiced` or to other stages. The worker never invokes this command.
- The demo and dev seeds write rows straight into the database and never call the service. That is fine for demo data and is not a production path.
- The guard runs before the transition (deal-invoice.service.ts:32-33), so a refused attempt writes nothing and leaves the version unchanged.

## Typed refusal and the staff message
- The new code `invoice_issuer_not_configured` is in the `DealBlockerCode` union (packages/domain/src/private-sale-deal/blockers.ts:22).
  Its message follows the existing "... has not been set up yet." pattern (blockers.ts:77-78).
- The refusal returns `{ kind: "blocked" }` and goes through the existing `resultOf` → `toBlocker` → `redactBlockers` path
  (deal-command.service.ts:305-310). The web shows `blocker.message` from the server (apps/web/src/lib/admin/private-sales/private-sales.vm.ts:340),
  so it needs no web change and no new design.
- The detail view shows the same blocker on the action before anyone clicks (deal-query.service.ts:388-389).

## Deals already in `invoiced` without a reference
These are untouched. Payment, bank transfer, cancel and settlement still work on them. The screen only shows the "Invoice" row when a
reference exists (apps/web/src/components/admin/private-sales/deal-sections.tsx:137), so no screen breaks.

## Money, payouts and settlement
Unchanged. No money computation, payout or settlement code is in the diff. The only behaviour change is the refusal described above.

## Audit trail
A refused move writes no event, as with every other blocker. A successful invoice is audited exactly as before: the transition records
`invoicedByUserId` and its event.

## Design
Minimal and clean. The service owns the rule through `blockers()`, and the query service depends on it through a narrow
`Pick<DealInvoiceService, "blockers">` (deal-query.service.ts:75). The PR does not choose an issuer; the runbook states that the choice is still open (PS-6).

## Tests
- deal-invoice.service.test.ts: with no issuer the outcome is blocked, nothing transitions and no reference is recorded; with an issuer there are no blockers.
- deal-desk.test.ts:649: the blocker and its exact staff message appear in the detail view and in the `act` result, the stage stays `cleared`, and nothing is written.
- transitions.test.ts:486: the message text.

Suites run here (throwaway Postgres 16 on port 55432, migrations applied, `--maxWorkers=2`), all green:
- packages/domain `src/private-sale-deal`: 9 files, 196 tests
- apps/api `src/services/private-sale-deal`, `routes/admin/private-sale-deals.routes.test.ts`, `src/container` (integration tests included): 36 files, 563 tests
- packages/persistence `drizzle-private-sale-deal*`: 5 files, 53 tests
- apps/web private-sales components, VMs and actions: 16 files, 169 tests
- apps/api `tsc --noEmit`: clean

## Non-blocking notes
1. When an issuer is configured but returns `null` or throws, the deal is still invoiced with no reference (deal-invoice.service.ts:64, 68-77).
   That behaviour predates this PR and is unchanged, but the new doc comment "a deal never reaches invoiced without a system that raises its invoice"
   (deal-invoice.service.ts:9-10) promises a little more than that. It is worth revisiting when an issuer is chosen.
2. The setup banner's `POLICY_GAP_LABELS` (apps/web/src/lib/admin/private-sales/private-sales.vm.ts:155) does not list invoicing, so staff only
   find out at the "Issue the invoice" action. That is acceptable because the blocker shows on the action before anyone clicks.
3. The runbook (docs/runbooks/private-sale-deals.md:33) could add one line on deals already in Invoiced with no reference: they carry on as before,
   and a reference can be attached once a system exists.
