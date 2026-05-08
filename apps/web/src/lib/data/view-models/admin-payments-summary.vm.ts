import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";

export type PaymentsSummaryVm = {
  totalVolume: number;
  captured: number;
  pending: number;
  refunded: number;
};

function numericAmount(row: AdminPaymentTableRow): number {
  const cleaned = row.amount.replace(/[^0-9.\-]+/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** Aggregate the loaded payment rows into the four KPI tiles displayed in the
 * accountant payments header. Pure helper; consumers may compose with their
 * own formatting layer.
 */
export function buildPaymentsSummary(rows: readonly AdminPaymentTableRow[]): PaymentsSummaryVm {
  const totalVolume = rows.reduce((sum, row) => sum + numericAmount(row), 0);
  const captured = rows
    .filter((row) => row.status === "captured")
    .reduce((sum, row) => sum + numericAmount(row), 0);
  const pending = rows
    .filter((row) => row.status === "pending" || row.status === "authorized")
    .reduce((sum, row) => sum + numericAmount(row), 0);
  const refunded = rows
    .filter((row) => row.status === "refunded")
    .reduce((sum, row) => sum + numericAmount(row), 0);
  return { totalVolume, captured, pending, refunded };
}
