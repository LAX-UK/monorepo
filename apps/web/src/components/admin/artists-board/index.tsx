"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { artistColumns } from "@/components/admin/artists-board/columns";
import { ArtistsMobileCards } from "@/components/admin/artists-board/mobile-cards";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import { getArtistBulkOperations } from "@/lib/admin/bulk-ops/artists";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminArtistListRow } from "@auction/types";
import { EntityList } from "@auction/ui";
import { useMemo } from "react";

type Props = {
  artists: AdminArtistListRow[];
  searchQuery?: string | undefined;
  canEdit?: boolean;
};

export function AdminArtistsBoard({ artists, canEdit = false }: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const pageIds = useMemo(() => artists.map((a) => a.id), [artists]);
  const bulkOperations = useMemo(() => getArtistBulkOperations(), []);
  const columns = useMemo(() => artistColumns(canEdit), [canEdit]);

  if (artists.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <EntityList
        density={density}
        responsiveMode="auto"
        table={
          <TableScroll>
            <AdminDataTable
              ariaLabel="Artists"
              columns={columns}
              data={artists}
              getRowId={(r) => r.id}
              density={density}
              enableRowSelection
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </TableScroll>
        }
        cards={
          <ArtistsMobileCards
            artists={artists}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            canEdit={canEdit}
          />
        }
      />
      <BulkActionsToolbar
        selectedIds={selectedIds}
        operations={bulkOperations}
        onClear={clear}
        pageRowCount={pageIds.length}
        onSelectAllOnPage={() => selectAllOnPage(pageIds)}
      />
    </div>
  );
}
