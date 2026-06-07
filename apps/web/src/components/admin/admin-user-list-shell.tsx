"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { useAdminUserPreviewActions } from "@/components/admin/admin-user-preview-provider";
import type { AdminUserListBulkBridge } from "@/components/admin/admin-user-preview-provider";
import { BulkActionsToolbar, type BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { useTableDensity } from "@/components/layout/density-provider";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@auction/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type AdminUserListKpi = KpiRowTile & { id?: string };

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
  buildColumns: (onOpen: (u: AdminUserRow) => void) => ColumnDef<AdminUserRow>[];
  bulkOperations: BulkOperation[];
  drawerTitle?: string;
  tableAriaLabel?: string;
  emptyMessage?: string;
  emptyComponent?: ReactNode;
  renderDrawerOverview: (user: AdminUserRow) => ReactNode;
  renderDrawerActions?: (user: AdminUserRow) => ReactNode;
  renderMobileCard?: (user: AdminUserRow, onOpen: () => void) => ReactNode;
  /** When true, mobile cards are rendered by the parent list shell. */
  externalMobileCards?: boolean;
  filtersSlot?: ReactNode;
  /** e.g. (id) => `/admin/clients/${id}` */
  detailHref?: (user: AdminUserRow) => string;
  showColumnPicker?: boolean;
  columnVisibilityStorageKey?: string;
};

export function AdminUserListShell({
  rows,
  totalMatches,
  buildColumns,
  bulkOperations,
  drawerTitle = "User",
  tableAriaLabel = "Accounts",
  emptyMessage = "No matching accounts.",
  emptyComponent,
  renderDrawerOverview,
  renderDrawerActions,
  renderMobileCard,
  externalMobileCards = false,
  filtersSlot,
  detailHref,
  showColumnPicker = false,
  columnVisibilityStorageKey,
}: Props) {
  const { density: shellDensity } = useTableDensity();
  const tableDensity = shellDensity === "compact" ? "compact" : "comfortable";
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const previewActions = useAdminUserPreviewActions();
  const registerOpenUser = previewActions?.registerOpenUser;
  const registerBulk = previewActions?.registerBulk;
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const onOpen = useCallback((u: AdminUserRow) => setSelected(u), []);

  useEffect(() => {
    if (!registerOpenUser || !externalMobileCards) return;
    registerOpenUser((userId) => {
      const user = rows.find((row) => row.id === userId);
      if (user) setSelected(user);
    });
  }, [registerOpenUser, externalMobileCards, rows]);

  useEffect(() => {
    if (!registerBulk || !externalMobileCards) {
      registerBulk?.(null);
      return;
    }

    const bulkBridge: AdminUserListBulkBridge = {
      selectedIds,
      operations: bulkOperations,
      clear,
      isSelected: (userId) => Boolean(rowSelection[userId]),
      toggleSelected: (userId, checked) => {
        setRowSelection((prev) => ({ ...prev, [userId]: checked }));
      },
    };
    registerBulk(bulkBridge);
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
  const columns = useMemo(() => buildColumns(onOpen), [buildColumns, onOpen]);

  const table = (
    <AdminDataTable
      ariaLabel={tableAriaLabel}
      columns={columns}
      data={rows}
      {...(emptyComponent ? { emptyComponent } : { emptyMessage })}
      density={tableDensity}
      stickyFirstColumn
      enableRowSelection
      getRowId={(row) => row.id}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      showColumnPicker={showColumnPicker}
      {...(columnVisibilityStorageKey ? { columnVisibilityStorageKey } : {})}
    />
  );

  const cards =
    !externalMobileCards && renderMobileCard ? (
      <ul className="space-y-3 lg:hidden">
        {rows.map((u) => (
          <li key={u.id}>{renderMobileCard(u, () => onOpen(u))}</li>
        ))}
      </ul>
    ) : null;

  return (
    <>
      <p className="mb-3 font-body text-xs text-on-surface-variant">
        Showing {rows.length} of {totalMatches} matching accounts on this page.
      </p>
      {externalMobileCards ? table : <div className="hidden lg:block">{table}</div>}
      {cards}
      {filtersSlot}
      {!externalMobileCards ? (
        <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
      ) : null}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              {detailHref ? (
                <AdminPreviewSheetHeader
                  title={selected.name}
                  sheetTitle={`${drawerTitle}: ${selected.name}`}
                  fullPageHref={detailHref(selected)}
                  subtitle={
                    <div className="space-y-2">
                      <p className="truncate font-body text-sm text-on-surface-variant">
                        {selected.email}
                      </p>
                      <AdminStatusBadge
                        domain="user"
                        status={selected.suspendedAt ? "suspended" : "active"}
                        size="sm"
                      />
                    </div>
                  }
                />
              ) : null}
              {!detailHref ? (
                <>
                  <SheetHeader className="sr-only">
                    <SheetTitle>
                      {drawerTitle}: {selected.name}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex items-start gap-3 border-b border-border-hairline pb-4">
                    <AdminUserAvatar user={selected} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="font-headline text-lg text-on-surface">{selected.name}</p>
                      <p className="truncate text-sm text-on-surface-variant">{selected.email}</p>
                      <div className="mt-2">
                        <AdminStatusBadge
                          domain="user"
                          status={selected.suspendedAt ? "suspended" : "active"}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {renderDrawerActions ? (
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview" className="font-label text-xs uppercase">
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="font-label text-xs uppercase">
                      Quick actions
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="mt-4">
                    {renderDrawerOverview(selected)}
                  </TabsContent>
                  <TabsContent value="actions" className="mt-4">
                    {renderDrawerActions(selected)}
                  </TabsContent>
                </Tabs>
              ) : (
                renderDrawerOverview(selected)
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
