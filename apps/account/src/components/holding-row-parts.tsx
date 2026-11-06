import { workDetailHref } from "@/server/domain/portfolio-routes";
import type { HoldingRowVm } from "@auction/lax-ecosystem";
import { CurrencyAmounts } from "./portfolio-parts";

export function documentsSummary(
  row: Pick<HoldingRowVm, "documentsAvailable" | "documentsExpected">,
): string {
  const { documentsAvailable: available, documentsExpected: expected } = row;
  if (available === 0 && expected === 0) return "None";
  const parts = [];
  if (available > 0) parts.push(`${available} available`);
  if (expected > 0) parts.push(`${expected} expected`);
  return parts.join(", ");
}

export function WorkTitle({ row }: { row: HoldingRowVm }) {
  return (
    <>
      <a
        href={workDetailHref(row.item)}
        className="inline-flex min-h-11 items-center font-medium break-words text-on-surface underline underline-offset-4"
      >
        {row.item.title || "Untitled work"}
      </a>
      {row.item.artist ? (
        <span className="block text-xs text-on-surface-variant">{row.item.artist}</span>
      ) : null}
      {row.item.edition ? (
        <span className="block text-xs text-on-surface-variant">{row.item.edition}</span>
      ) : null}
    </>
  );
}

/** The amount to show: the total due while awaiting payment, else what was paid. */
export function amountsOf(row: HoldingRowVm) {
  return row.due.length > 0 ? row.due : row.paid;
}

/** What the amount in a row is: owed, being confirmed, or paid. */
export function amountLabel(status: HoldingRowVm["item"]["status"]): string {
  if (status === "awaiting_payment") return "Due";
  return status === "payment_confirming" ? "Confirming" : "Paid";
}

/** A work whose payment waits on account checks says so beside its amount. */
export function InReviewNote({ row }: { row: HoldingRowVm }) {
  if (row.item.owed?.state !== "in_review") return null;
  return <span className="block text-xs text-on-surface-variant">Waiting on account checks</span>;
}

export function PaidCell({ row }: { row: HoldingRowVm }) {
  const amounts = amountsOf(row);
  return (
    <>
      {(row.item.status === "awaiting_payment" || row.item.status === "payment_confirming") &&
      amounts.length > 0 ? (
        <span className="mr-1 text-xs text-on-surface-variant">{amountLabel(row.item.status)}</span>
      ) : null}
      <CurrencyAmounts totals={amounts} />
      <InReviewNote row={row} />
    </>
  );
}
