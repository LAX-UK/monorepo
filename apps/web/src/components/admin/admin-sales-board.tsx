"use client";

import { useTableDensity } from "@/components/layout/dashboard-shell";
import { saleStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import type { SaleStatus } from "@auction/types";
import { DataTable, EntityTableShell, InlineActionMenu, Sparkline, StatusBadge } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
      cell: ({ row }) => (
        <StatusBadge variant={saleStatusToBadgeVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
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
      cell: ({ row }) => (
        <InlineActionMenu
          label={`Actions for ${row.original.title}`}
          items={[
            {
              type: "item",
              label: "Manage",
              onSelect: () => {
                window.location.href = `/admin/sales/${row.original.saleId}`;
              },
            },
            {
              type: "item",
              label: "View on site",
              onSelect: () => {
                window.location.href = `/sales/${row.original.saleId}`;
              },
            },
            {
              type: "item",
              label: "Copy sale ID",
              onSelect: () => {
                void navigator.clipboard.writeText(row.original.saleId);
              },
            },
          ]}
        />
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminSaleBoardRow[];
  statusChips: ReactNode;
  toolbarEnd?: ReactNode;
};

export function AdminSalesBoard({ rows, statusChips, toolbarEnd }: Props) {
  const { density } = useTableDensity();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(needle));
  }, [rows, q]);

  const columns = useMemo(() => saleColumns(), []);

  const cards = (
    <ul className="space-y-3">
      {filtered.map((r) => (
        <li
          key={r.saleId}
          className="rounded-sm border border-outline-variant/15 bg-surface-container-lowest/80 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/sales/${r.saleId}`}
                className="font-headline text-base text-on-surface hover:text-primary"
              >
                {r.title}
              </Link>
              <p className="mt-1 font-label text-[10px] uppercase tracking-widest text-secondary">
                {r.lotCount} lot{r.lotCount === 1 ? "" : "s"}
              </p>
            </div>
            <StatusBadge variant={saleStatusToBadgeVariant(r.status)}>{r.status}</StatusBadge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Sparkline values={r.sparklineValues} width={96} height={28} tone="lot-orange" />
            <InlineActionMenu
              label={`Actions for ${r.title}`}
              items={[
                {
                  type: "item",
                  label: "Manage",
                  onSelect: () => {
                    window.location.href = `/admin/sales/${r.saleId}`;
                  },
                },
                {
                  type: "item",
                  label: "View on site",
                  onSelect: () => {
                    window.location.href = `/sales/${r.saleId}`;
                  },
                },
              ]}
            />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <EntityTableShell
      responsiveMode="auto"
      density={density}
      filters={statusChips}
      search={
        <div className="grid w-full min-w-0 flex-1 gap-1 sm:max-w-md">
          <label
            htmlFor="admin-sales-q"
            className="font-label text-xs uppercase tracking-widest text-secondary"
          >
            Filter title
          </label>
          <Input
            id="admin-sales-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to filter loaded rows…"
            className="min-h-11 text-base md:text-sm"
          />
        </div>
      }
      toolbarEnd={toolbarEnd}
      table={
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No sales match this filter."
          density={density}
        />
      }
      cards={cards}
    />
  );
}
