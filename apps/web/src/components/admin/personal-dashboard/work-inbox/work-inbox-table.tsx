"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { WorkInboxRowActions } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-row-actions";
import {
  ownerLabel,
  severityAccentClass,
} from "@/components/admin/personal-dashboard/work-inbox/work-inbox-utils";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useMemo } from "react";

type Props = {
  items: readonly AdminWorkItem[];
  actorUserId: string;
  onOpenPreview: (item: AdminWorkItem) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
};

function itemMetaLine(item: AdminWorkItem, actorUserId: string): string {
  const parts = [item.domain, ownerLabel(item, actorUserId)];
  if (item.severity === "critical" || item.severity === "high") {
    parts.push(item.severity);
  }
  return parts.join(" · ");
}

function showSeverityAccent(severity: AdminWorkItem["severity"]): boolean {
  return severity === "critical" || severity === "high";
}

export function WorkInboxTable({
  items,
  actorUserId,
  onOpenPreview,
  rowSelection,
  onRowSelectionChange,
}: Props) {
  const { density } = useTableDensity();

  const columns = useMemo<ColumnDef<AdminWorkItem>[]>(
    () => [
      {
        id: "title",
        header: "Item",
        accessorKey: "title",
        cell: ({ row }) => {
          const accent = showSeverityAccent(row.original.severity);
          return (
            <button
              type="button"
              className={`lift-row -mx-2 w-full text-left ${accent ? `border-l-2 pl-3 ${severityAccentClass(row.original.severity)}` : "pl-0.5"}`}
              onClick={() => onOpenPreview(row.original)}
            >
              <div className="font-headline text-sm font-medium text-on-surface">
                {row.original.title}
              </div>
              {row.original.subtitle ? (
                <div className="text-xs text-on-surface-variant">{row.original.subtitle}</div>
              ) : null}
              <div className="mt-0.5 font-body text-xs text-on-surface-variant">
                {itemMetaLine(row.original, actorUserId)}
              </div>
            </button>
          );
        },
      },
      {
        id: "due",
        header: "Due",
        cell: ({ row }) => (
          <AdminTableDateTimeCell
            iso={row.original.dueAt ?? row.original.createdAt}
            mode="deadline"
            live={row.original.severity === "critical" || row.original.severity === "high"}
          />
        ),
        meta: { numeric: true },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <WorkInboxRowActions item={row.original} layout="inline" />,
      },
    ],
    [actorUserId, onOpenPreview],
  );

  return (
    <div className="hidden lg:block">
      <AdminDataTable<AdminWorkItem, unknown>
        ariaLabel="Work inbox"
        columns={columns}
        data={[...items]}
        density={density}
        enableKeyboardNav
        enableRowSelection={Boolean(onRowSelectionChange)}
        getRowId={(row) => row.id}
        onRowActivate={(row) => onOpenPreview(row)}
        stickyFirstColumn
        {...(rowSelection !== undefined ? { rowSelection } : {})}
        {...(onRowSelectionChange ? { onRowSelectionChange } : {})}
      />
    </div>
  );
}
