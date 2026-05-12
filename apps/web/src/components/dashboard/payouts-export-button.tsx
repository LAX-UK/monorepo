"use client";

import { Button as UiButton } from "@auction/ui/components/button";
import { Download } from "lucide-react";
import { useCallback } from "react";

export type PayoutExportRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  status: string;
};

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rowsToCsv(rows: PayoutExportRow[]): string {
  const header = [
    "id",
    "period_start",
    "period_end",
    "gross_amount",
    "platform_fee",
    "stripe_fee",
    "net_amount",
    "currency",
    "status",
  ];
  const body = rows.map((row) =>
    [
      row.id,
      row.periodStart.slice(0, 10),
      row.periodEnd.slice(0, 10),
      row.grossAmount,
      row.platformFee,
      row.stripeFee,
      row.netAmount,
      row.currency,
      row.status,
    ]
      .map(escapeCsv)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export function PayoutsExportButton({ rows }: { rows: PayoutExportRow[] }) {
  const onClick = useCallback(() => {
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `payouts-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <UiButton
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={rows.length === 0}
      className="gap-2"
    >
      <Download className="size-4" aria-hidden /> Export CSV
    </UiButton>
  );
}
