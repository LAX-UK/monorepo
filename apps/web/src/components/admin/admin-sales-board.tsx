"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { useTableDensity } from "@/components/layout/density-provider";
import { getSaleBulkOperations } from "@/lib/admin/bulk-ops/sales";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { salePath } from "@/lib/seo/url";
import type { SaleStatus } from "@auction/types";
import { EntityList, InlineActionMenu, Sparkline } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo } from "react";

function SaleActionMenu({ row }: { row: AdminSaleBoardRow }) {
  const router = useRouter();
  return (
    <InlineActionMenu
      label={`Actions for ${row.title}`}
      items={[
        {
          type: "item",
          label: "Manage",
          onSelect: () => router.push(`/admin/sales/${row.saleId}`),
        },
        {
          type: "item",
          label: "View on site",
          onSelect: () => window.open(salePath({ id: row.saleId, title: row.title }), "_blank"),
        },
        {
          type: "item",
          label: "Copy sale ID",
          onSelect: () => void navigator.clipboard.writeText(row.saleId),
        },
      ]}
    />
  );
}

export type AdminSaleBoardRow = {
  saleId: string;
  title: string;
  status: SaleStatus;
  lotCount: number;
  sparklineValues: number[];
};

function saleColumns(): ColumnDef<AdminSaleBoardRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Sale",
      cell: ({ row }) => (
        <Link
          href={`/admin/sales/${row.original.saleId}`}
          className="font-headline text-base text-on-surface hover:text-primary"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="sale" status={row.original.status} />,
    },
    {
      id: "lots",
      header: "Lots",
      accessorKey: "lotCount",
      cell: ({ row }) => (
        <span className="font-label text-xs tabular-nums text-on-surface-variant">
          {row.original.lotCount}
        </span>
      ),
    },
    {
      id: "spark",
      header: "Ends (7d)",
      cell: ({ row }) => (
        <Sparkline values={row.original.sparklineValues} width={80} height={28} tone="lot-orange" />
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <SaleActionMenu row={row.original} />,
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminSaleBoardRow[];
  statusChips?: ReactNode;
  toolbarEnd?: ReactNode;
};

export function AdminSalesBoard({ rows, statusChips, toolbarEnd }: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(() => saleColumns(), []);
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const bulkOperations = useMemo(() => getSaleBulkOperations(), []);

  const cards = (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.saleId}
          className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/sales/${r.saleId}`}
                className="font-headline text-base text-on-surface hover:text-primary"
              >
                {r.title}
              </Link>
              <p className="mt-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                {r.lotCount} lot{r.lotCount === 1 ? "" : "s"}
              </p>
            </div>
            <AdminStatusBadge domain="sale" status={r.status} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Sparkline values={r.sparklineValues} width={96} height={28} tone="lot-orange" />
            <SaleActionMenu row={r} />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <EntityList
        responsiveMode="auto"
        density={density}
        filters={statusChips ?? null}
        toolbarEnd={toolbarEnd}
        table={
          <AdminDataTable
            ariaLabel="Sales"
            columns={columns}
            data={rows}
            emptyMessage="No sales on this page."
            density={density}
            enableRowSelection
            getRowId={(r) => r.saleId}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            showColumnPicker
            columnVisibilityStorageKey="admin-sales-columns"
          />
        }
        cards={cards}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
