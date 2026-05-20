"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { payoutColumns } from "@/components/admin/payouts-board/columns";
import { PayoutDrawerContent } from "@/components/admin/payouts-board/drawer";
import { PayoutsMobileCards } from "@/components/admin/payouts-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminPayoutRow[];
  statusChips?: ReactNode;
  settlementBand?: ReactNode;
  kpiStrip?: ReactNode;
};

export function AdminPayoutsBoard({ rows, statusChips, settlementBand, kpiStrip }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminPayoutRow | null>(null);
  const onOpen = useCallback((row: AdminPayoutRow) => setSelected(row), []);
  const columns = useMemo(() => payoutColumns(onOpen), [onOpen]);

  return (
    <>
      {kpiStrip}
      {settlementBand}
      <EntityList
        responsiveMode="auto"
        density={density}
        {...(statusChips ? { filters: statusChips } : {})}
        table={
          <AdminDataTable
            ariaLabel="Payouts"
            columns={columns}
            data={rows}
            emptyMessage="No payouts match this filter."
            density={density}
            getRowId={(r) => r.id}
          />
        }
        cards={<PayoutsMobileCards rows={rows} onOpen={onOpen} />}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={`Payout ${selected.id.slice(0, 8)}…`}
                fullPageHref={`/admin/payouts?highlight=${selected.id}`}
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    Entity {selected.legalEntityId.slice(0, 8)}…
                  </p>
                }
              />
              <PayoutDrawerContent payout={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
