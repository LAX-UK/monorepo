"use client";

import { DisputeEffectList } from "@/components/admin/disputes/dispute-effect-list";
import { useDisputeAllocation } from "@/components/admin/disputes/use-dispute-allocation";
import { sellerShareOf } from "@/lib/admin/finance/dispute-allocation";
import {
  type DisputeAllocationMode,
  type DisputeInvoiceRow,
  disputeInvoiceRows,
} from "@/lib/admin/finance/dispute-case.vm";
import {
  type DataColumn,
  DataTable,
  MoneyInput,
  Notice,
  Section,
  StaffButton,
  StaffDate,
  StatusBadge,
  formatStaffMoney,
} from "@auction/staff-ui";
import { CircleAlert, CircleCheck, Split } from "@auction/staff-ui/icons";
import type { DisputeDeskCase } from "@auction/types";
import { type ReactNode, useCallback, useMemo } from "react";

/** Formats pence in the case's currency; stable between renders so columns can depend on it. */
function useCurrency(currency: string) {
  return useCallback((pence: number) => formatStaffMoney(pence, currency), [currency]);
}

const CLAWBACK_LABELS = {
  none: "Not taken yet",
  withdrawn: "Taken from payout",
  reversed: "Returned to seller",
} as const;

function invoiceCell(row: DisputeInvoiceRow): ReactNode {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-staff-fg">{row.invoice.lotTitle}</p>
      <p className="truncate text-staff-xs text-staff-muted">
        {row.invoice.sellerName} · Payment {row.invoice.reference}
      </p>
    </div>
  );
}

/** The columns every mode shares: which invoice and whose, and how much it is worth. */
function baseColumns(currency: string): DataColumn<DisputeInvoiceRow>[] {
  return [
    {
      id: "invoice",
      header: "Invoice",
      mobile: "title",
      cell: invoiceCell,
    },
    {
      id: "total",
      header: "Invoice total",
      width: "120px",
      numeric: true,
      mobile: "meta",
      cell: (row) => formatStaffMoney(row.invoice.invoicePence, currency),
    },
  ];
}

function AllocationNotice({
  found,
  totalPence,
  deadlinePassed,
}: {
  found: DisputeDeskCase;
  totalPence: number;
  deadlinePassed: boolean;
}) {
  const money = (pence: number) => formatStaffMoney(pence, found.currency);
  return (
    <>
      <Notice tone="info" title="One card payment settled several invoices">
        The card payment of {money(totalPence)} settled {found.invoices.length} invoices. Choose how
        much of the {money(found.amountPence)} dispute belongs to each. Until you save, no seller's
        payout changes.
      </Notice>
      {deadlinePassed ? (
        <Notice tone="warning" title="The evidence window has closed">
          The card network decides on what was submitted. You can still allocate the dispute.
        </Notice>
      ) : null}
    </>
  );
}

/** The editable allocation: one share per invoice, a total that must match, and the effects. */
function EditableAllocation({
  found,
  deadlinePassed,
}: {
  found: DisputeDeskCase;
  deadlinePassed: boolean;
}) {
  const allocation = useDisputeAllocation(found);
  const money = useCurrency(found.currency);
  const rows = useMemo(() => disputeInvoiceRows(found), [found]);
  const totalPence = found.invoices.reduce((sum, invoice) => sum + invoice.invoicePence, 0);
  const { check, shares, showProblems } = allocation;
  const locked = allocation.saving;

  const columns = useMemo<DataColumn<DisputeInvoiceRow>[]>(
    () => [
      ...baseColumns(found.currency),
      {
        id: "share",
        header: "Dispute share",
        width: "168px",
        numeric: true,
        truncate: false,
        mobile: "meta",
        cell: (row) => {
          const problem = showProblems ? check.rowProblems[row.invoice.paymentId] : undefined;
          return (
            <div className="flex flex-col items-end gap-1">
              <MoneyInput
                size="sm"
                aria-label={`Dispute share for ${row.invoice.lotTitle}`}
                value={shares[row.invoice.paymentId] ?? 0}
                onValueChange={(pence) => allocation.setShare(row.invoice.paymentId, pence)}
                disabled={locked}
                invalid={problem !== undefined}
                {...(problem
                  ? { "aria-describedby": `share-problem-${row.invoice.paymentId}` }
                  : {})}
              />
              {problem ? (
                <p
                  id={`share-problem-${row.invoice.paymentId}`}
                  className="text-staff-xs text-staff-danger"
                >
                  {problem === "exceeds_invoice"
                    ? "More than the invoice total"
                    : "Cannot be negative"}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "net",
        header: "Taken from seller",
        width: "148px",
        numeric: true,
        mobile: "hidden",
        cell: (row) => money(sellerShareOf(row.invoice, shares[row.invoice.paymentId] ?? 0)),
      },
    ],
    [found.currency, money, shares, showProblems, check.rowProblems, locked, allocation],
  );

  const mismatch = check.remainingPence !== 0;
  const summary = mismatch
    ? check.remainingPence > 0
      ? `${money(check.remainingPence)} is left to allocate. The shares must add up to the disputed amount.`
      : `${money(-check.remainingPence)} is over the disputed amount. The shares must add up to it.`
    : null;

  return (
    <>
      <AllocationNotice found={found} totalPence={totalPence} deadlinePassed={deadlinePassed} />
      <DataTable<DisputeInvoiceRow>
        embedded
        label="Invoices on this charge"
        columns={columns}
        data={rows}
        getRowId={(row) => row.invoice.paymentId}
        defaultSort={{ columnId: "invoice", direction: "asc" }}
        density="comfortable"
      />
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t border-staff-line-subtle px-1 pt-3 text-staff-sm"
        aria-live="polite"
      >
        <span className="font-medium text-staff-fg">Allocated</span>
        <span
          className={
            mismatch && showProblems
              ? "inline-flex items-center gap-1.5 font-medium text-staff-danger tabular-nums"
              : "inline-flex items-center gap-1.5 font-medium text-staff-fg tabular-nums"
          }
        >
          {mismatch ? (
            <CircleAlert aria-hidden className="size-3.5" />
          ) : (
            <CircleCheck aria-hidden className="size-3.5 text-staff-success" />
          )}
          {money(check.allocatedPence)} of {money(found.amountPence)}
        </span>
      </div>
      {mismatch && summary && showProblems ? (
        <p className="flex items-start gap-1.5 text-staff-sm text-staff-danger" role="alert">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {summary}
        </p>
      ) : null}
      <DisputeEffectList
        effects={allocation.effects}
        currency={found.currency}
        fundsTaken={allocation.fundsTaken}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StaffButton variant="secondary" onClick={allocation.splitProportionally} disabled={locked}>
          <Split aria-hidden className="size-4" />
          Split in proportion
        </StaffButton>
        <StaffButton variant="primary" loading={locked} onClick={allocation.requestSave}>
          Save allocation
        </StaffButton>
      </div>
      {allocation.dialog}
    </>
  );
}

/** What someone who cannot allocate sees: the invoices, and that the finance team decides. */
function AwaitingAllocation({ found }: { found: DisputeDeskCase }) {
  const columns = useMemo(() => baseColumns(found.currency), [found.currency]);
  const rows = useMemo(() => disputeInvoiceRows(found), [found]);
  return (
    <>
      <Notice tone="info" title="Not allocated yet">
        This card payment settled {found.invoices.length} invoices. The finance team chooses how
        much of the dispute belongs to each. Until they do, no seller's payout changes.
      </Notice>
      <DataTable<DisputeInvoiceRow>
        embedded
        label="Invoices on this charge"
        columns={columns}
        data={rows}
        getRowId={(row) => row.invoice.paymentId}
        defaultSort={{ columnId: "invoice", direction: "asc" }}
        density="comfortable"
      />
    </>
  );
}

/** The saved allocation, line by line, with what each line has done to its seller's payout. */
function SavedAllocation({ found }: { found: DisputeDeskCase }) {
  const money = useCurrency(found.currency);
  const rows = useMemo(() => disputeInvoiceRows(found).filter((row) => row.line), [found]);
  const columns = useMemo<DataColumn<DisputeInvoiceRow>[]>(
    () => [
      ...baseColumns(found.currency),
      {
        id: "share",
        header: "Dispute share",
        width: "120px",
        numeric: true,
        mobile: "meta",
        cell: (row) => money(row.line?.amountPence ?? 0),
      },
      {
        id: "net",
        header: "Taken from seller",
        width: "176px",
        numeric: true,
        truncate: false,
        mobile: "meta",
        cell: (row) =>
          row.line ? (
            <div className="flex flex-col items-end">
              <span>{money(row.line.sellerSharePence)}</span>
              <span className="text-staff-xs text-staff-muted">
                {CLAWBACK_LABELS[row.line.clawback]}
              </span>
            </div>
          ) : null,
      },
    ],
    [found.currency, money],
  );
  return (
    <DataTable<DisputeInvoiceRow>
      embedded
      label="Allocated invoices"
      columns={columns}
      data={rows}
      getRowId={(row) => row.invoice.paymentId}
      defaultSort={{ columnId: "invoice", direction: "asc" }}
      density="comfortable"
    />
  );
}

function allocatedBadge(found: DisputeDeskCase): ReactNode {
  const [first] = found.allocations;
  if (!first) return null;
  if (first.source === "staff") {
    return (
      <StatusBadge tone="success">
        Allocated <StaffDate value={first.allocatedAt} className="text-inherit" />
        {first.allocatedByName ? ` by ${first.allocatedByName}` : ""}
      </StatusBadge>
    );
  }
  return <StatusBadge tone="success">Allocated automatically</StatusBadge>;
}

/**
 * How the dispute falls on its invoices. It is edited by the finance team while the case waits
 * for allocation, shown as saved lines once it is allocated, and explained when nothing matched
 * the charge or the case needs no allocation.
 */
export function DisputeAllocationCard({
  found,
  mode,
  canAllocate,
  deadlinePassed,
}: {
  found: DisputeDeskCase;
  mode: DisputeAllocationMode;
  canAllocate: boolean;
  /** The evidence window has closed; the card network decides on what was submitted. */
  deadlinePassed: boolean;
}) {
  const title = mode === "allocate" && canAllocate ? "Allocate to invoices" : "Allocation";
  return (
    <Section
      title={title}
      id="allocation"
      action={mode === "allocated" ? allocatedBadge(found) : undefined}
      bodyClassName="flex flex-col gap-4"
    >
      {mode === "allocate" && canAllocate ? (
        <EditableAllocation found={found} deadlinePassed={deadlinePassed} />
      ) : null}
      {mode === "allocate" && !canAllocate ? <AwaitingAllocation found={found} /> : null}
      {mode === "allocated" ? <SavedAllocation found={found} /> : null}
      {mode === "unmatched" ? (
        <Notice tone="warning" title="No payment matched this dispute">
          Stripe reported a card charge that no Bid invoice carries, so no seller's payout has
          changed. Check the charge in Stripe to find which payment it belongs to.
        </Notice>
      ) : null}
      {mode === "not_needed" ? (
        <p className="text-staff-sm text-staff-muted">
          This dispute ended without a loss, so no seller's payout changed and nothing needs
          allocating.
        </p>
      ) : null}
    </Section>
  );
}
