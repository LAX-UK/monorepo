"use client";

import { useAdminBulkSelectionActions } from "@/components/admin/admin-bulk-selection-bridge";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { InvitationExpiryCountdown } from "@/components/admin/invitation-expiry-countdown";
import { InvitationRowActions } from "@/components/admin/invitation-row-actions";
import { InvitationDrawerContent } from "@/components/admin/invitations-board/drawer";
import { useTableDensity } from "@/components/layout/density-provider";
import { getInvitationBulkOperations } from "@/lib/admin/bulk-ops/invitations";
import { invitationRoleLabel } from "@/lib/admin/invitation-role-label";
import { invitationLifecycleDisplay } from "@/lib/admin/invite-lifecycle";
import { useAdminListPreviewReturnFocus } from "@/lib/admin/use-admin-list-preview-return-focus";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.server";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import { Button, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo } from "react";

function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function columns(
  onOpen: (row: AdminInvitationSummary, trigger: HTMLElement) => void,
): ColumnDef<AdminInvitationSummary>[] {
  return [
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 py-0 text-left font-body text-sm text-link underline-offset-2 hover:underline"
          onClick={(event) => onOpen(row.original, event.currentTarget)}
        >
          {row.original.email}
        </Button>
      ),
    },
    {
      accessorKey: "targetRole",
      header: "Role",
      cell: ({ row }) => invitationRoleLabel(row.original.targetRole, row.original.targetStaffRole),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original;
        const expiresAt = coerceDate(r.expiresAt);
        const openedAt = r.openedAt ? coerceDate(r.openedAt) : null;
        const display = invitationLifecycleDisplay({
          status: r.status,
          expiresAt,
          openedAt,
          inviteEmailLastStatus: r.inviteEmailLastStatus,
        });
        if (display.kind === "revoked") {
          return <AdminStatusBadge domain="invitation" status="revoked" />;
        }
        return <AdminStatusBadge domain="inviteLifecycle" status={display.pill} size="sm" />;
      },
      enableSorting: false,
    },
    {
      id: "sent",
      header: "Sent",
      cell: ({ row }) => {
        const createdAt = coerceDate(row.original.createdAt);
        return (
          <div className="space-y-0.5">
            <p className="font-body text-sm text-on-surface">{formatRelativeTime(createdAt)}</p>
            <p className="font-body text-[11px] text-on-surface-variant">
              {formatDateTime(createdAt)}
            </p>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "invitedBy",
      header: "Invited by",
      cell: ({ row }) => (
        <span className="font-body text-sm text-on-surface">
          {row.original.invitedByName ?? "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "expires",
      header: "Expires",
      cell: ({ row }) => {
        const expiresAt = coerceDate(row.original.expiresAt);
        const terminal = row.original.status !== "pending" || expiresAt.getTime() <= Date.now();
        return <InvitationExpiryCountdown expiresAt={expiresAt} active={!terminal} />;
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => {
        const r = row.original;
        const expiresAt = coerceDate(r.expiresAt);
        return (
          <InvitationRowActions
            invitationId={r.id}
            lifecycle={{
              status: r.status,
              expiresAt,
              openedAt: r.openedAt ? coerceDate(r.openedAt) : null,
              inviteEmailLastStatus: r.inviteEmailLastStatus,
            }}
          />
        );
      },
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminInvitationSummary[];
  /** When true, mobile cards are rendered by the parent list shell. */
  externalMobileCards?: boolean;
  selected?: AdminInvitationSummary | null;
  onOpen?: (invitation: AdminInvitationSummary) => void;
  onCloseDrawer?: () => void;
};

export function AdminInvitationsBoard({
  rows,
  externalMobileCards = false,
  selected = null,
  onOpen,
  onCloseDrawer,
}: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const { captureReturnFocus, restoreReturnFocus } = useAdminListPreviewReturnFocus();
  const handleOpen = useCallback(
    (invitation: AdminInvitationSummary, trigger: HTMLElement) => {
      captureReturnFocus(trigger);
      onOpen?.(invitation);
    },
    [captureReturnFocus, onOpen],
  );
  const tableColumns = useMemo(() => columns(handleOpen), [handleOpen]);
  const bulkOperations = useMemo(() => getInvitationBulkOperations(), []);
  const bulkActions = useAdminBulkSelectionActions();
  const registerBulk = bulkActions?.registerBulk;

  useEffect(() => {
    if (!registerBulk || !externalMobileCards) {
      registerBulk?.(null);
      return;
    }

    registerBulk({
      selectedIds,
      operations: bulkOperations,
      clear,
      isSelected: (id) => Boolean(rowSelection[id]),
      toggleSelected: (id, checked) => {
        setRowSelection((prev) => ({ ...prev, [id]: checked }));
      },
    });
    return () => registerBulk(null);
  }, [
    registerBulk,
    externalMobileCards,
    selectedIds,
    bulkOperations,
    clear,
    rowSelection,
    setRowSelection,
  ]);

  return (
    <>
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Invitations
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-secondary px-2 font-label text-xs font-medium text-on-secondary"
              >
                {rows.length}
              </Badge>
            </>
          }
        />
        <div className="p-4 sm:p-6">
          <AdminDataTable
            ariaLabel="Invitations"
            columns={tableColumns}
            data={rows}
            density={density}
            enableRowSelection
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            className="[&_table]:border-0"
          />
        </div>
      </CatalogBoardCard>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            onCloseDrawer?.();
            restoreReturnFocus();
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader title={selected.email} subtitle="Invitation preview" />
              <InvitationDrawerContent invitation={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
