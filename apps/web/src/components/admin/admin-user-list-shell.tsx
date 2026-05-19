"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { BulkActionsToolbar, type BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { useTableDensity } from "@/components/layout/density-provider";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { EntityList, Sheet, SheetContent, SheetHeader, SheetTitle, StatusBadge } from "@auction/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

export type AdminUserListKpi = KpiRowTile & { id?: string };

type Props = {
  rows: AdminUserRow[];
  totalMatches: number;
  kpis: AdminUserListKpi[];
  buildColumns: (onOpen: (u: AdminUserRow) => void) => ColumnDef<AdminUserRow>[];
  bulkOperations: BulkOperation[];
  drawerTitle?: string;
  kpiAriaLabel?: string;
  tableAriaLabel?: string;
  emptyMessage?: string;
  renderDrawerOverview: (user: AdminUserRow) => ReactNode;
  renderDrawerActions?: (user: AdminUserRow) => ReactNode;
  renderMobileCard: (user: AdminUserRow, onOpen: () => void) => ReactNode;
  filtersSlot?: ReactNode;
};

export function AdminUserListShell({
  rows,
  totalMatches,
  kpis,
  buildColumns,
  bulkOperations,
  drawerTitle = "User",
  kpiAriaLabel = "Account summary",
  tableAriaLabel = "Accounts",
  emptyMessage = "No matching accounts.",
  renderDrawerOverview,
  renderDrawerActions,
  renderMobileCard,
  filtersSlot,
}: Props) {
  const { density: shellDensity } = useTableDensity();
  const tableDensity = shellDensity === "compact" ? "compact" : "comfortable";
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const onOpen = useCallback((u: AdminUserRow) => setSelected(u), []);
  const columns = useMemo(() => buildColumns(onOpen), [buildColumns, onOpen]);

  const cards = (
    <ul className="space-y-3">
      {rows.map((u) => (
        <li key={u.id}>{renderMobileCard(u, () => onOpen(u))}</li>
      ))}
    </ul>
  );

  return (
    <>
      <KpiRow className="mb-2" tiles={kpis} aria-label={kpiAriaLabel} />
      <p className="mb-3 font-body text-xs text-on-surface-variant">
        Showing {rows.length} of {totalMatches} matching accounts on this page.
      </p>
      <EntityList
        responsiveMode="auto"
        filters={filtersSlot ?? null}
        table={
          <AdminDataTable
            ariaLabel={tableAriaLabel}
            columns={columns}
            data={rows}
            emptyMessage={emptyMessage}
            density={tableDensity}
            enableRowSelection
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        }
        cards={cards}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
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
                    <StatusBadge variant={selected.suspendedAt ? "danger" : "success"} size="sm">
                      {selected.suspendedAt ? "Suspended" : "Active"}
                    </StatusBadge>
                  </div>
                </div>
              </div>
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
