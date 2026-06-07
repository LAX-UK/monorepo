"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  formatEmailDeliverabilityStatus,
  formatSignupPersona,
} from "@/lib/admin/admin-user-presenters";
import { copyTextToClipboard } from "@/lib/admin/copy-text";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { relativeFromIso } from "@/lib/admin/relative-time";
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
    cell: ({ row }) => (
      <span className="text-xs text-on-surface-variant">
        {formatSignupPersona(row.original.signupPersona)}
      </span>
    ),
  };
}

export function userTwoFactorColumn(): ColumnDef<AdminUserRow> {
  return {
    id: "twoFactor",
    header: "2FA",
    cell: ({ row }) => (
      <AdminStatusBadge
        domain="kyc"
        status={row.original.twoFactorEnabled ? "approved" : "unverified"}
        label={row.original.twoFactorEnabled ? "On" : "Off"}
        size="sm"
      />
    ),
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
    cell: ({ row }) => (
      <span className="text-xs text-on-surface-variant">
        {row.original.kycVerifiedAt ? formatAdminUserDate(row.original.kycVerifiedAt) : "—"}
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
