"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { LotBoardMobileActionMenu } from "@/components/admin/lots-board/mobile-action-menu";
import type { AdminLotTableRow } from "@/components/admin/lots-board/types";
import { adminLotEditHref, adminLotHref } from "@/lib/admin/catalog-route-helpers";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
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
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <CatalogMobileCardShell
          key={r.id}
          id={r.id}
          title={r.title}
          selected={rowSelection?.[r.id]}
          onSelectedChange={
            onRowSelectionChange
              ? (checked) => {
                  onRowSelectionChange((prev) => ({
                    ...prev,
                    [r.id]: checked,
                  }));
                }
              : undefined
          }
          selectionLabel={`Select ${r.title}`}
          trailing={<LotBoardMobileActionMenu row={r} canManageCatalog={canManageCatalog} />}
          status={<AdminStatusBadge domain="lot" status={r.status} />}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                <Link href={adminLotEditHref(r.id)}>Edit</Link>
              </Button>
              <Button variant="secondary" size="sm" className="min-h-11 flex-1" asChild>
                <Link href={adminLotHref(r.id)}>Open</Link>
              </Button>
            </div>
          }
        >
          <Link href={adminLotHref(r.id)} className="font-headline text-sm text-primary">
            {r.title}
          </Link>
          <p className="font-label text-[10px] uppercase text-on-surface-variant">
            {r.auctionType} · {r.endTimeLabel}
          </p>
          {r.lastActivityLabel ? (
            <p className="font-body text-xs text-on-surface-variant">
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
          <p className="font-headline text-sm tabular-nums">{r.currentPrice}</p>
        </CatalogMobileCardShell>
      ))}
    </ul>
  );
}
