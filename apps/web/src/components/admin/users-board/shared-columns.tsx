"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { SignupPersonaBadge } from "@/components/admin/signup-persona-badge";
import { formatEmailDeliverabilityStatus } from "@/lib/admin/admin-user-presenters";
import { copyTextToClipboard } from "@/lib/admin/copy-text";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { InlineActionMenu } from "@auction/ui";
import { formatPhoneDisplay } from "@auction/validators";
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
    cell: ({ row }) => <AdminTableDateTimeCell iso={row.original.createdAt} mode="dateOnly" />,
  };
}

export function userMobileColumn(): ColumnDef<AdminUserRow> {
  return {
    id: "mobile",
    header: "Mobile",
    cell: ({ row }) => {
      const u = row.original;
      const display = formatPhoneDisplay(u.mobile);
      if (!display) return <span className="text-xs text-on-surface-variant">—</span>;
      return (
        <span className="text-xs text-on-surface-variant" title={u.mobile ?? undefined}>
          {display}
          {u.mobileCountry ? ` (${u.mobileCountry})` : ""}
        </span>
      );
    },
  };
}

export function userPersonaColumn(): ColumnDef<AdminUserRow> {
  return {
    id: "persona",
    header: "Persona",
    cell: ({ row }) => <SignupPersonaBadge persona={row.original.signupPersona} size="compact" />,
  };
}

export function userEmailStatusColumn(): ColumnDef<AdminUserRow> {
  return {
    id: "emailStatus",
    header: "Email health",
    cell: ({ row }) => (
      <span className="text-xs text-on-surface-variant">
        {formatEmailDeliverabilityStatus(row.original.emailStatus)}
      </span>
    ),
  };
}

export function userKycVerifiedAtColumn(): ColumnDef<AdminUserRow> {
  return {
    id: "kycVerifiedAt",
    header: "KYC verified",
    cell: ({ row }) =>
      row.original.kycVerifiedAt ? (
        <AdminTableDateTimeCell iso={row.original.kycVerifiedAt} mode="dateOnly" />
      ) : (
        <span className="text-xs text-on-surface-variant">—</span>
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
                onSelect: () => void copyTextToClipboard(u.id),
              },
            ]}
          />
        </div>
      );
    },
    enableSorting: false,
  };
}
