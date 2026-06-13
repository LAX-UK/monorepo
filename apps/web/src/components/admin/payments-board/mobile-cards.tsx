"use client";

import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@auction/ui";

type Props = {
  rows: AdminPaymentTableRow[];
  onOpen: (row: AdminPaymentTableRow) => void;
};

export function PaymentsMobileCards({ rows, onOpen }: Props) {
  return (
    <ul className="space-y-3">
      {rows.map((p) => (
        <li
          key={p.id}
          className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 min-w-0 flex-1 justify-start rounded-none px-0 py-0 text-left font-headline text-base text-on-surface hover:bg-transparent hover:text-link"
              onClick={() => onOpen(p)}
            >
              {p.lotTitle}
            </Button>
            <AdminStatusBadge domain="payment" status={p.status} />
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {p.buyerLabel?.trim() || "Buyer profile"}
          </p>
          <p className="mt-1 tabular-nums text-sm">{p.amount}</p>
          {p.fulfilmentStatus ? (
            <p className="mt-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
              Fulfilment: {p.fulfilmentStatus.replaceAll("_", " ")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-3 min-h-11 w-full"
            onClick={() => onOpen(p)}
          >
            Manage payment
          </Button>
        </li>
      ))}
    </ul>
  );
}
