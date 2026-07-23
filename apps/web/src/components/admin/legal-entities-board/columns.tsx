"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  formatLegalEntityKindSubkind,
  stripeSummaryLabel,
} from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin-legal-entities.shared";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";

export function legalEntityColumns(
  stripeLens: boolean,
  onOpen: (row: AdminLegalEntityListRow) => void,
): ColumnDef<AdminLegalEntityListRow>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Name",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[16rem] truncate px-0 py-0 text-left font-medium text-link underline-offset-2 hover:underline"
          onClick={() => onOpen(row.original)}
        >
          {row.original.displayName}
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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onOpen(row.original)}
          >
            Preview
          </Button>
        </div>
      ),
    },
  ];
}
