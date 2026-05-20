"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { InlineActionMenu } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function userStatusColumn(): ColumnDef<AdminUserRow> {
  return {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <AdminStatusBadge domain="user" status={row.original.suspendedAt ? "suspended" : "active"} />
    ),
  };
}

export function userJoinedColumn(): ColumnDef<AdminUserRow> {
  return {
    accessorKey: "createdAt",
    header: "Joined",
    cell: ({ row }) => (
      <span className="text-xs text-on-surface-variant">
        {formatAdminUserDate(row.original.createdAt)}
      </span>
    ),
  };
}

export function userLastActivityColumn(header = "Last activity"): ColumnDef<AdminUserRow> {
  return {
    id: "lastActivity",
    header,
    cell: ({ row }) => (
      <span className="text-xs text-on-surface-variant">
        {relativeFromIso(row.original.updatedAt)}
      </span>
    ),
  };
}

export function userRowActionsColumn(onOpen: (u: AdminUserRow) => void): ColumnDef<AdminUserRow> {
  return {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="flex justify-end">
          <InlineActionMenu
            label={`Actions for ${u.name}`}
            items={[
              { type: "item", label: "Open details", onSelect: () => onOpen(u) },
              {
                type: "item",
                label: "Copy user ID",
                onSelect: () => void navigator.clipboard.writeText(u.id),
              },
            ]}
          />
        </div>
      );
    },
    enableSorting: false,
  };
}
