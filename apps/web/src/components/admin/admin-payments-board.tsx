"use client";

import { adminCapturePaymentAction, adminRefundPaymentAction } from "@/lib/actions/admin";
import { paymentStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { useTableDensity } from "@/components/layout/dashboard-shell";
import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import type { PaymentStatus } from "@auction/types";
import {
  Button,
  DataTable,
  EntityTableShell,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusBadge,
} from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

function paymentColumns(onOpen: (row: AdminPaymentTableRow) => void): ColumnDef<AdminPaymentTableRow>[] {
  return [
    {
      accessorKey: "lotTitle",
      header: "Lot",
      cell: ({ row }) => (
        <button
          type="button"
          className="max-w-[14rem] truncate text-left font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => onOpen(row.original)}
        >
          {row.original.lotTitle}
        </button>
      ),
    },
    {
      accessorKey: "buyerId",
      header: "Buyer",
      cell: ({ row }) => (
        <span className="max-w-[10rem] truncate font-mono text-xs">{row.original.buyerId}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => <span className="tabular-nums">{row.original.amount}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={paymentStatusToBadgeVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={() => onOpen(row.original)}
        >
          Manage
        </Button>
      ),
      enableSorting: false,
    },
  ];
}

function PaymentDrawerContent({ p, onClose }: { p: AdminPaymentTableRow; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-[10px] uppercase tracking-widest text-secondary">Lot</p>
        <Link
          href={`/admin/lots/${p.lotId}`}
          className="font-headline text-base text-primary hover:underline"
          onClick={onClose}
        >
          {p.lotTitle}
        </Link>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Payment ID</dt>
          <dd className="font-mono text-xs">{p.id}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Buyer</dt>
          <dd className="font-mono text-xs break-all">{p.buyerId}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Seller</dt>
          <dd className="font-mono text-xs break-all">{p.sellerId}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Amount</dt>
          <dd className="tabular-nums">{p.amount}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Platform fee</dt>
          <dd className="tabular-nums">{p.platformFee}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
          <dd>
            <StatusBadge variant={paymentStatusToBadgeVariant(p.status)}>{p.status}</StatusBadge>
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 border-t border-outline-variant/15 pt-4">
        {(p.status === "pending" || p.status === "authorized") && (
          <form action={adminCapturePaymentAction} className="w-full">
            <input type="hidden" name="paymentId" value={p.id} />
            <Button type="submit" className="min-h-11 w-full">
              Mark captured
            </Button>
          </form>
        )}
        {p.status !== "refunded" ? (
          <form action={adminRefundPaymentAction} className="w-full">
            <input type="hidden" name="paymentId" value={p.id} />
            <Button type="submit" variant="secondary" className="min-h-11 w-full text-error">
              Refund
            </Button>
          </form>
        ) : (
          <p className="text-sm text-on-surface-variant">This payment was refunded.</p>
        )}
      </div>
    </div>
  );
}

type Props = {
  rows: AdminPaymentTableRow[];
  statusChips: ReactNode;
};

export function AdminPaymentsBoard({ rows, statusChips }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminPaymentTableRow | null>(null);
  const [q, setQ] = useState("");

  const onOpen = useCallback((row: AdminPaymentTableRow) => setSelected(row), []);

  const columns = useMemo(() => paymentColumns(onOpen), [onOpen]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.lotTitle.toLowerCase().includes(needle) ||
        r.buyerId.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const cards = (
    <ul className="space-y-3">
      {filtered.map((p) => (
        <li
          key={p.id}
          className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest/80 p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-h-11 min-w-0 flex-1 text-left font-headline text-base text-on-surface hover:text-primary"
              onClick={() => setSelected(p)}
            >
              {p.lotTitle}
            </button>
            <StatusBadge variant={paymentStatusToBadgeVariant(p.status)}>{p.status}</StatusBadge>
          </div>
          <p className="mt-2 font-mono text-[10px] text-on-surface-variant">{p.buyerId}</p>
          <p className="mt-1 tabular-nums text-sm">{p.amount}</p>
          <Button type="button" variant="secondary" className="mt-3 min-h-11 w-full" onClick={() => setSelected(p)}>
            Manage payment
          </Button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <EntityTableShell
        responsiveMode="auto"
        density={density}
        filters={statusChips}
        search={
          <div className="grid w-full min-w-0 flex-1 gap-1 sm:max-w-md">
            <label htmlFor="admin-pay-q" className="font-label text-xs uppercase tracking-widest text-secondary">
              Search
            </label>
            <input
              id="admin-pay-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Lot title, buyer ID, payment ID…"
              className="min-h-11 rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-base text-on-surface md:text-sm"
            />
          </div>
        }
        table={
          <DataTable
            columns={columns}
            data={filtered}
            emptyMessage="No payments match this filter."
            density={density}
          />
        }
        cards={cards}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Payment</SheetTitle>
                <SheetDescription>Capture or refund from this drawer on any screen size.</SheetDescription>
              </SheetHeader>
              <PaymentDrawerContent p={selected} onClose={() => setSelected(null)} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
