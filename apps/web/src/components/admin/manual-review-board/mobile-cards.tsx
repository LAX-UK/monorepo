"use client";

import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/ui/format";
import { Button } from "@auction/ui";

export function ManualReviewMobileCards({
  rows,
  onOpen,
}: {
  rows: AdminManualReviewPaymentRow[];
  onOpen: (row: AdminManualReviewPaymentRow) => void;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.paymentId} className="rounded-lg border border-border-hairline p-4">
          <p className="font-medium">{row.lotTitle}</p>
          <p className="mt-1 text-sm tabular-nums">{formatMoney(row.amount, row.currency)}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => onOpen(row)}
          >
            Review
          </Button>
        </li>
      ))}
    </ul>
  );
}
