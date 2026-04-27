"use client";

import { AdminPaymentXeroPanel } from "@/components/admin/admin-payment-xero-panel";
import {
  AdminPaymentActions,
  type AdminPaymentTableRow,
} from "@/components/admin/admin-payments-data-table";
import { useTableDensity } from "@/components/layout/dashboard-shell";
import { paymentStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { adminPaymentLocalSearchSchema } from "@/lib/forms/schemas/url-search";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

function paymentColumns(
  onOpen: (row: AdminPaymentTableRow) => void,
): ColumnDef<AdminPaymentTableRow>[] {
  return [
    {
      accessorKey: "lotTitle",
      header: "Lot",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => onOpen(row.original)}
        >
          {row.original.lotTitle}
        </Button>
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
      id: "xero",
      header: "Xero",
      cell: ({ row }) =>
        row.original.xeroOnlineInvoiceUrl ? (
          <a
            href={row.original.xeroOnlineInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Invoice
          </a>
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
      enableSorting: false,
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

      <AdminPaymentXeroPanel
        id={p.id}
        xeroInvoiceNumber={p.xeroInvoiceNumber}
        xeroOnlineInvoiceUrl={p.xeroOnlineInvoiceUrl}
        xeroSyncStatus={p.xeroSyncStatus}
        xeroLastError={p.xeroLastError}
      />

      <AdminPaymentActions id={p.id} status={p.status} fullWidth />
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
  const searchForm = useForm({
    resolver: zodResolver(adminPaymentLocalSearchSchema),
    defaultValues: { q: "" },
  });
  const q = searchForm.watch("q") ?? "";

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
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 min-w-0 flex-1 justify-start rounded-none px-0 py-0 text-left font-headline text-base text-on-surface hover:bg-transparent hover:text-primary"
              onClick={() => setSelected(p)}
            >
              {p.lotTitle}
            </Button>
            <StatusBadge variant={paymentStatusToBadgeVariant(p.status)}>{p.status}</StatusBadge>
          </div>
          <p className="mt-2 font-mono text-[10px] text-on-surface-variant">{p.buyerId}</p>
          <p className="mt-1 tabular-nums text-sm">{p.amount}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 min-h-11 w-full"
            onClick={() => setSelected(p)}
          >
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
          <Form {...searchForm}>
            <form
              className="grid w-full min-w-0 flex-1 gap-1 sm:max-w-md"
              onSubmit={(e) => e.preventDefault()}
            >
              <FormField
                control={searchForm.control}
                name="q"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      htmlFor="admin-pay-q"
                      className="font-label text-xs uppercase tracking-widest text-secondary"
                    >
                      Search
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="admin-pay-q"
                        placeholder="Lot title, buyer ID, payment ID…"
                        className="min-h-11 text-base md:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
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
                <SheetDescription>
                  Capture or refund from this drawer on any screen size.
                </SheetDescription>
              </SheetHeader>
              <PaymentDrawerContent p={selected} onClose={() => setSelected(null)} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
