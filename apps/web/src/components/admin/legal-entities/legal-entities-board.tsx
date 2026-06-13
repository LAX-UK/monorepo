"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { TableScroll } from "@/components/ui/table-scroll";
import {
  formatLegalEntityKindSubkind,
  stripeSummaryLabel,
} from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

type Props = {
  rows: AdminLegalEntityListRow[];
  stripeLens?: boolean;
};

function legalEntityColumns(stripeLens: boolean): ColumnDef<AdminLegalEntityListRow>[] {
  const cols: ColumnDef<AdminLegalEntityListRow>[] = [
    {
      accessorKey: "displayName",
      header: "Name",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[16rem] truncate px-0 py-0 text-left font-medium text-link underline-offset-2 hover:underline"
          asChild
        >
          <Link href={`/admin/legal-entities/${row.original.id}`}>{row.original.displayName}</Link>
        </Button>
      ),
    },
    {
      id: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface">
          {formatLegalEntityKindSubkind(row.original.kind, row.original.subkind)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <AdminStatusBadge domain="legalEntity" status={row.original.status} size="sm" />
      ),
    },
    {
      id: "stripe",
      header: stripeLens ? "Requirements" : "Stripe",
      cell: ({ row }) => {
        const count = row.original.stripeDueCount;
        if (stripeLens) {
          return <span className="text-xs text-on-surface">{stripeSummaryLabel(count)}</span>;
        }
        return (
          <span className="text-xs text-on-surface-variant">
            {count > 0 ? stripeSummaryLabel(count) : "—"}
          </span>
        );
      },
    },
    {
      id: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-on-surface-variant">
          {formatDateTime(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {stripeLens && row.original.stripeDueCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
              <Link href={`/admin/legal-entities/${row.original.id}?tab=stripe`}>Stripe</Link>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
            <Link href={`/admin/legal-entities/${row.original.id}`}>Open</Link>
          </Button>
        </div>
      ),
    },
  ];
  return cols;
}

export function LegalEntitiesBoard({ rows, stripeLens = false }: Props) {
  const columns = useMemo(() => legalEntityColumns(stripeLens), [stripeLens]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <TableScroll>
      <AdminDataTable
        ariaLabel="Legal entities"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
      />
    </TableScroll>
  );
}
