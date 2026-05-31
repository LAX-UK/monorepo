"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { LotBoardMobileActionMenu } from "@/components/admin/lots-board/mobile-action-menu";
import type { AdminLotTableRow } from "@/components/admin/lots-board/types";
import {
  adminLotEditCatalogHref,
  adminLotEditHref,
  adminLotHref,
} from "@/lib/admin/catalog-route-helpers";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";

type Props = {
  rows: AdminLotTableRow[];
  canManageCatalog?: boolean;
  canManageAuction?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
};

export function LotsMobileCards({
  rows,
  canManageCatalog = false,
  canManageAuction = false,
  rowSelection,
  onRowSelectionChange,
}: Props) {
  return (
    <CatalogVirtualizedList itemCount={rows.length}>
      {rows.map((r) => {
        const editHref = canManageCatalog
          ? r.status === "draft" || r.status === "scheduled"
            ? adminLotEditHref(r.id)
            : r.status === "active"
              ? adminLotEditCatalogHref(r.id)
              : null
          : null;
        return (
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
            trailing={
              <LotBoardMobileActionMenu
                row={r}
                canManageCatalog={canManageCatalog}
                canManageAuction={canManageAuction}
              />
            }
            status={<AdminStatusBadge domain="lot" status={r.status} />}
            footer={
              <div className="flex flex-wrap gap-2">
                {editHref ? (
                  <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                    <Link href={editHref}>Edit</Link>
                  </Button>
                ) : null}
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
        );
      })}
    </CatalogVirtualizedList>
  );
}
