import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { buildPaymentsSummary } from "@/lib/data/view-models/admin-payments-summary.vm";

function formatCompactAmount(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

type Props = {
  rows: readonly AdminPaymentTableRow[];
  className?: string;
};

/**
 * Mockup-aligned KPI strip for the accountant payments page. Composes the
 * shared `KpiGrid` with payment-specific aggregates — Total volume, Settled
 * (captured), Awaiting action (pending + authorized), Refunded.
 */
export function PaymentsKpiStrip({ rows, className }: Props) {
  const summary = buildPaymentsSummary(rows);
  return (
    <KpiGrid
      className={className ?? "mb-6"}
      tiles={[
        {
          label: "Total volume",
          value: formatCompactAmount(summary.totalVolume),
          delta: "Loaded rows",
          emphasize: true,
        },
        {
          label: "Settled",
          value: formatCompactAmount(summary.captured),
          delta: "Captured payments",
          trendTone: "primary",
        },
        {
          label: "Awaiting action",
          value: formatCompactAmount(summary.pending),
          delta: "Pending + authorized",
          trendTone: "live-red",
        },
        {
          label: "Refunded",
          value: formatCompactAmount(summary.refunded),
          delta: "Refunded payments",
          trendTone: "secondary",
        },
      ]}
    />
  );
}
