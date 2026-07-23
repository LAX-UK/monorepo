"use client";

import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import {
  DetailBoardKpiStrip,
  DetailBoardShell,
  DetailBoardToolbar,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { AdminSaleLotQrPrintButton } from "@/components/admin/qr-code/admin-sale-lot-qr-print-button";
import { SaleLotsTabSection } from "@/components/admin/sale-lots-tab-section";
import { ExportButton } from "@/components/exports/export-button";
import { MediaImage } from "@/components/ui/media-image";
import {
  adminCancelLotInSaleResultAction,
  adminDetachLotFromSaleResultAction,
  adminSetLotStatusResultAction,
} from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { saleSetupHref } from "@/lib/admin/sale-setup";
import {
  type SaleLotsFilterContext,
  type SaleLotsLens,
  buildSaleLotsKpiTiles,
  filterSaleLotsByLens,
  formatLotEstimateDisplay,
  formatLotHammerForTable,
  matchesSaleLotSearch,
  resolveSaleLotsBoardMode,
  saleLotsBoardFilters,
} from "@/lib/data/view-models/sale-lots-tab.vm";
import type { ActionResult } from "@/lib/forms/form-result";
import { lotDotStatusPresentation } from "@/lib/presenters/status/lot-dot-status";
import { notify } from "@/lib/ui/notify";
import type { CategoryNode, Lot, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const LOT_TRANSITION_OPTIONS: Record<Lot["status"], Lot["status"][]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["cancelled"],
  active: ["ended", "cancelled"],
  ended: [],
  cancelled: [],
  voided: [],
};

type Props = {
  saleId: string;
  sale: {
    status: SaleStatus;
    deliveryMode: SaleDeliveryMode;
    startTime: Date;
    endTime: Date;
  };
  lots: Lot[];
  canManageAuction?: boolean;
  categories?: CategoryNode[];
  englishOnlyAuctionsLocked?: boolean;
};

export function SaleLotsTabBoard({
  saleId,
  sale,
  lots,
  canManageAuction = false,
  categories = [],
  englishOnlyAuctionsLocked = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const boardMode = resolveSaleLotsBoardMode(sale.status);
  const filters = saleLotsBoardFilters(boardMode);
  const [lens, setLens] = useState<SaleLotsLens>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  const saleContext = useMemo<SaleLotsFilterContext>(
    () => ({
      deliveryMode: sale.deliveryMode,
      startTime: sale.startTime,
      endTime: sale.endTime,
    }),
    [sale.deliveryMode, sale.startTime, sale.endTime],
  );

  const rowLots = useMemo(
    () =>
      filterSaleLotsByLens(lots, lens, saleContext, boardMode).filter((lot) =>
        matchesSaleLotSearch({ title: lot.title, lotNumber: lot.lotNumber }, search),
      ),
    [lots, lens, saleContext, boardMode, search],
  );

  const kpiTiles = buildSaleLotsKpiTiles(lots, saleContext, boardMode);
  const canEditDraft = sale.status === "draft";
  const canAddLots =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";

  const run = (fn: () => Promise<ActionResult<void>>) => {
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (r.ok) {
          notify.success("Done");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Lots summary" tiles={kpiTiles} />

      <DetailBoardShell
        title="Lots"
        count={rowLots.length}
        actions={
          <>
            {canManageAuction ? (
              <AdminSaleLotQrPrintButton
                lots={lots.map((l) => ({ id: l.id, title: l.title, lotNumber: l.lotNumber }))}
              />
            ) : null}
            <ExportButton entityType="lots" filters={{ saleId }} />
            {canEditDraft ? (
              <Link
                href={saleSetupHref(saleId, "lots")}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
              >
                Add lots in setup →
              </Link>
            ) : canAddLots ? (
              <a
                href="#add-lot-to-live-sale"
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
              >
                Add new lot →
              </a>
            ) : null}
          </>
        }
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search lots…"
            filters={filters}
            activeFilter={lens}
            onFilterChange={(id) => setLens(id as SaleLotsLens)}
            filterAriaLabel="Filter lots"
          />
        }
        footer={
          rowLots.length > 0 ? (
            <span>
              Showing {rowLots.length} of {lots.length} lot{lots.length === 1 ? "" : "s"}
              {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
            </span>
          ) : undefined
        }
      >
        <DetailEntityTable
          rows={rowLots}
          getRowId={(lot) => lot.id}
          emptyTitle="No lots attached yet."
          selectable
          selectedIds={selectedIds}
          onToggleRow={(id, checked) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
          onToggleAll={(checked) =>
            setSelectedIds(checked ? new Set(rowLots.map((lot) => lot.id)) : new Set())
          }
          columns={[
            {
              id: "lot",
              header: "Lot",
              cell: (lot) => (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border-hairline bg-surface-container-low">
                    {lot.images[0] ? (
                      <MediaImage
                        src={lot.images[0]}
                        alt=""
                        label={lot.title}
                        imgClassName="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] text-on-surface-variant">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/lots/${lot.id}`}
                      className="font-headline text-sm font-medium text-on-surface hover:text-link"
                    >
                      {lot.title}
                    </Link>
                    <p className="mt-0.5 font-body text-xs text-on-surface-variant">
                      Lot #{lot.lotNumber ?? "—"}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              id: "estimate",
              header: "Estimate",
              cell: (lot) => (
                <AdminTableMoneyCell display={formatLotEstimateDisplay(lot)} emphasis="muted" />
              ),
            },
            {
              id: "value",
              header: "Current",
              cell: (lot) => (
                <AdminTableMoneyCell display={formatLotHammerForTable(lot)} emphasis="hammer" />
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (lot) => {
                const { label, tone } = lotDotStatusPresentation({
                  status: lot.status,
                  winnerId: lot.winnerId,
                  context: "sale-board",
                });
                return <DotStatusPill label={label} tone={tone} />;
              },
            },
            {
              id: "actions",
              header: "",
              headerClassName: "sr-only",
              className: "text-right",
              cell: (lot) => {
                const transitions = LOT_TRANSITION_OPTIONS[lot.status];
                return (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 px-2 font-label text-xs"
                    >
                      <Link href={`/admin/lots/${lot.id}`}>Open</Link>
                    </Button>
                    {canEditDraft ? (
                      <ConfirmActionButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 font-label text-xs"
                        disabled={pending}
                        confirmTitle="Detach lot from sale?"
                        confirmBody="Detach this lot from the sale? It returns to inventory as a standalone draft lot."
                        confirmLabel="Detach"
                        tone="warning"
                        onConfirmed={() =>
                          run(() => adminDetachLotFromSaleResultAction(saleId, lot.id))
                        }
                      >
                        Detach
                      </ConfirmActionButton>
                    ) : null}
                    {canManageAuction &&
                    transitions.includes("cancelled") &&
                    sale.status !== "ended" &&
                    sale.status !== "cancelled" ? (
                      <ConfirmActionButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 font-label text-xs"
                        disabled={pending}
                        confirmTitle="Cancel lot"
                        confirmBody={`Cancel lot "${lot.title}"?`}
                        confirmLabel="Cancel lot"
                        onConfirmed={() =>
                          run(() => adminCancelLotInSaleResultAction(saleId, lot.id))
                        }
                      >
                        Cancel
                      </ConfirmActionButton>
                    ) : null}
                    {canManageAuction
                      ? transitions
                          .filter((t) => t !== "cancelled")
                          .map((next) => (
                            <ConfirmActionButton
                              key={next}
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 font-label text-xs"
                              disabled={pending}
                              confirmTitle={`Mark as ${next}`}
                              confirmBody={`Mark lot "${lot.title}" as ${next}?`}
                              confirmLabel={`Mark ${next}`}
                              onConfirmed={() =>
                                run(() => adminSetLotStatusResultAction(saleId, lot.id, next))
                              }
                            >
                              Mark {next}
                            </ConfirmActionButton>
                          ))
                      : null}
                  </div>
                );
              },
            },
          ]}
        />
      </DetailBoardShell>

      <DetailBoardShell
        title="Lot management"
        description="Attach, add, and return lots for this sale."
      >
        <SaleLotsTabSection
          saleId={saleId}
          saleStatus={sale.status}
          deliveryMode={sale.deliveryMode}
          saleStartTime={sale.startTime}
          saleEndTime={sale.endTime}
          canEditDraft={canEditDraft}
          canAddLots={canAddLots}
          categories={categories}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          canManageAuction={canManageAuction}
          hideTable
          lots={lots.map((l) => ({
            id: l.id,
            title: l.title,
            lotNumber: l.lotNumber,
            status: l.status,
            winnerId: l.winnerId ?? null,
            imageUrl: l.images[0] ?? null,
          }))}
        />
      </DetailBoardShell>
    </div>
  );
}
