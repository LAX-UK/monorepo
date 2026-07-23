"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { LotAuctionTypeChip } from "@/components/admin/lot-auction-type-chip";
import { LotSaleContextCell } from "@/components/admin/lots-board/lot-sale-context-cell";
import { LotBoardMobileActionMenu } from "@/components/admin/lots-board/mobile-action-menu";
import type { AdminLotTableRow } from "@/components/admin/lots-board/types";
import { MediaImage } from "@/components/ui/media-image";
import {
  adminLotEditCatalogHref,
  adminLotEditHref,
  adminLotHref,
} from "@/lib/admin/catalog-route-helpers";
import { lotDotStatusPresentation } from "@/lib/presenters/status/lot-dot-status";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
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
            status={(() => {
              const { label, tone } = lotDotStatusPresentation({
                status: r.status,
                context: "global",
              });
              return <DotStatusPill label={label} tone={tone} />;
            })()}
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
            <div className="flex min-w-0 items-start gap-3">
              {r.thumbnailUrl ? (
                <MediaImage
                  src={r.thumbnailUrl}
                  alt=""
                  label={r.title}
                  sizes="40px"
                  className="size-10 shrink-0 overflow-hidden rounded-md"
                  imgClassName="size-full object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <Link href={adminLotHref(r.id)} className="font-headline text-sm text-primary">
                  {r.title}
                </Link>
                <p className="font-label text-xs text-on-surface-variant">
                  Lot #{r.lotNumber ?? "—"}
                </p>
                <LotSaleContextCell
                  saleId={r.saleId}
                  saleTitle={r.saleTitle}
                  saleStatus={r.saleStatus}
                  saleDeliveryMode={r.saleDeliveryMode}
                  variant="card"
                />
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                  <LotAuctionTypeChip auctionType={r.auctionType} />
                  <AdminTableDateTimeCell
                    iso={r.endTimeIso}
                    mode="deadline"
                    live
                    className="shrink-0 whitespace-nowrap font-label text-xs uppercase"
                  />
                </div>
                {r.estimateDisplay.primary !== "—" ? (
                  <p className="font-body text-xs text-on-surface-variant">
                    Est. {r.estimateDisplay.primary}
                  </p>
                ) : null}
              </div>
            </div>
            <AdminTableMoneyCell display={r.hammerDisplay} emphasis="hammer" />
          </CatalogMobileCardShell>
        );
      })}
    </CatalogVirtualizedList>
  );
}
