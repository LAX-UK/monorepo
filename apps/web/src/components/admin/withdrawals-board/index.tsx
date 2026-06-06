"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { withdrawalColumns } from "@/components/admin/withdrawals-board/columns";
import { WithdrawalDrawerContent } from "@/components/admin/withdrawals-board/drawer";
import { WithdrawalsMobileCards } from "@/components/admin/withdrawals-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

export function AdminWithdrawalsBoard({ tasks }: { tasks: LotWithdrawalRequestTask[] }) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<LotWithdrawalRequestTask | null>(null);
  const onOpen = useCallback((row: LotWithdrawalRequestTask) => setSelected(row), []);
  const columns = useMemo(() => withdrawalColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Withdrawal requests"
            columns={columns}
            data={tasks}
            emptyMessage="No withdrawal requests."
            density={density}
            getRowId={(r) => r.id}
          />
        }
        cards={<WithdrawalsMobileCards tasks={tasks} onOpen={onOpen} />}
      />
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Withdrawal request"
                fullPageHref={
                  selected.targetLotId
                    ? `/admin/lots/${selected.targetLotId}`
                    : "/admin/lots?lens=attention"
                }
                subtitle={
                  <p className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                    {selected.kind.replaceAll("_", " ")}
                    {selected.status ? ` · ${selected.status.replaceAll("_", " ")}` : ""}
                  </p>
                }
              />
              <WithdrawalDrawerContent task={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
