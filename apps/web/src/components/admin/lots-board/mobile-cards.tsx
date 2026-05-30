"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { LotBoardMobileActionMenu } from "@/components/admin/lots-board/mobile-action-menu";
import type { AdminLotTableRow } from "@/components/admin/lots-board/types";
import { adminLotEditHref, adminLotHref } from "@/lib/admin/catalog-route-helpers";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";

type Props = {
  rows: AdminLotTableRow[];
  canManageCatalog?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
};

export function LotsMobileCards({
  rows,
  canManageCatalog = false,
  rowSelection,
  onRowSelectionChange,
}: Props) {
  const showSelection = Boolean(onRowSelectionChange);

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {showSelection ? (
                <Checkbox
                  className="mt-1 min-h-11 min-w-11"
                  checked={Boolean(rowSelection?.[r.id])}
                  onCheckedChange={(checked) => {
                    onRowSelectionChange?.((prev) => ({
                      ...prev,
                      [r.id]: checked === true,
                    }));
                  }}
                  aria-label={`Select ${r.title}`}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <Link href={adminLotHref(r.id)} className="font-headline text-sm text-primary">
                  {r.title}
                </Link>
                <p className="mt-1 font-label text-[10px] uppercase text-on-surface-variant">
                  {r.auctionType} · {r.endTimeLabel}
                </p>
                {r.lastActivityLabel ? (
                  <p className="mt-1 font-body text-xs text-on-surface-variant">
                    {r.lastActivityLabel}
                    {r.lastActivityAt ? (
                      <>
                        {" "}
                        ·{" "}
                        <time dateTime={r.lastActivityAt}>
                          {formatDateTime(new Date(r.lastActivityAt))}
                        </time>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <p className="mt-1 font-headline text-sm tabular-nums">{r.currentPrice}</p>
                <div className="mt-2">
                  <AdminStatusBadge domain="lot" status={r.status} />
                </div>
              </div>
            </div>
            <LotBoardMobileActionMenu row={r} canManageCatalog={canManageCatalog} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
              <Link href={adminLotEditHref(r.id)}>Edit</Link>
            </Button>
            <Button variant="secondary" size="sm" className="min-h-11 flex-1" asChild>
              <Link href={adminLotHref(r.id)}>Open</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
