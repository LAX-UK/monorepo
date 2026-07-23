"use client";

import { AttachExistingLotReview } from "@/components/admin/attach-existing-lot-review";
import { DetailCardGrid, DetailEntityTable } from "@/components/admin/catalog/detail-board";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { EmergencyAddLotPanel } from "@/components/admin/sale-lots-tab/emergency-add-lot-panel";
import { MediaImage } from "@/components/ui/media-image";
import { DisplayHeading } from "@/components/ui/typography";
import { adminReturnLotToInventoryResultAction } from "@/lib/actions/admin";
import {
  adminCancelLotInSaleResultAction,
  adminDetachLotFromSaleResultAction,
  adminSetLotStatusResultAction,
} from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { attachExistingLotPanelBody } from "@/lib/admin/sale-setup";
import type { ActionResult } from "@/lib/forms/form-result";
import { lotDotStatusPresentation } from "@/lib/presenters/status/lot-dot-status";
import { notify } from "@/lib/ui/notify";
import type { CategoryNode, LotStatus, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type SaleLotsTabLotRow = {
  id: string;
  title: string;
  lotNumber: number | null;
  status: LotStatus;
  winnerId?: string | null;
  imageUrl?: string | null;
};

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  saleStartTime: Date;
  saleEndTime: Date;
  canEditDraft: boolean;
  canAddLots: boolean;
  categories?: CategoryNode[];
  englishOnlyAuctionsLocked?: boolean;
  canManageAuction?: boolean;
  lots: SaleLotsTabLotRow[];
  /** When true, hides the duplicate lot-count header (parent card owns it). */
  compact?: boolean;
  /** When true, skips the primary table/grid (parent board owns it). */
  hideTable?: boolean;
};

const LOT_TRANSITION_OPTIONS: Record<LotStatus, LotStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["cancelled"],
  active: ["ended", "cancelled"],
  ended: [],
  cancelled: [],
  voided: [],
};

type ViewMode = "list" | "grid";

export function SaleLotsTabSection({
  saleId,
  saleStatus,
  deliveryMode,
  saleStartTime,
  saleEndTime,
  canEditDraft,
  canAddLots,
  categories = [],
  englishOnlyAuctionsLocked = false,
  canManageAuction = false,
  lots,
  compact = false,
  hideTable = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ViewMode>("list");
  const isSaleroom = isSaleroomDeliveryMode(deliveryMode);
  const returnEligible = lots.filter(
    (l) =>
      (l.status === "ended" || l.status === "cancelled" || l.status === "voided") && !l.winnerId,
  );

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
    <div className="space-y-10">
      {!hideTable ? (
        <div>
          {!compact ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-sm text-on-surface-variant">
                {lots.length} lot{lots.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-1 rounded-lg border border-shell-stroke p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={view === "list" ? "secondary" : "ghost"}
                  className="h-8 gap-1.5 px-2.5"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                >
                  <List className="size-4" aria-hidden />
                  List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === "grid" ? "secondary" : "ghost"}
                  className="h-8 gap-1.5 px-2.5"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                >
                  <LayoutGrid className="size-4" aria-hidden />
                  Grid
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex justify-end">
              <div className="flex items-center gap-1 rounded-lg border border-shell-stroke p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={view === "list" ? "secondary" : "ghost"}
                  className="h-8 gap-1.5 px-2.5"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                >
                  <List className="size-4" aria-hidden />
                  List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === "grid" ? "secondary" : "ghost"}
                  className="h-8 gap-1.5 px-2.5"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                >
                  <LayoutGrid className="size-4" aria-hidden />
                  Grid
                </Button>
              </div>
            </div>
          )}

          {view === "grid" ? (
            <DetailCardGrid
              columns={4}
              emptyTitle="No lots attached yet."
              items={lots.map((l) => {
                const { label, tone } = lotDotStatusPresentation({
                  status: l.status,
                  winnerId: l.winnerId,
                  context: "sale-board",
                });
                return {
                  id: l.id,
                  href: `/admin/lots/${l.id}`,
                  image: l.imageUrl ? (
                    <MediaImage
                      src={l.imageUrl}
                      alt={l.title}
                      label={l.title}
                      imgClassName="size-full object-cover"
                      sizes="(max-width: 640px) 50vw, 200px"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center font-body text-xs text-on-surface-variant">
                      No image
                    </div>
                  ),
                  title: l.title,
                  subtitle: `Lot #${l.lotNumber ?? "—"}`,
                  badge: { label, tone },
                };
              })}
            />
          ) : (
            <DetailEntityTable
              rows={lots}
              getRowId={(l) => l.id}
              emptyTitle="No lots attached yet."
              columns={[
                {
                  id: "lot",
                  header: "Lot",
                  cell: (l) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-shell-stroke bg-surface-container-low">
                        {l.imageUrl ? (
                          <MediaImage
                            src={l.imageUrl}
                            alt=""
                            label={l.title}
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
                          href={`/admin/lots/${l.id}`}
                          className="font-headline text-base text-on-surface hover:text-link"
                        >
                          {l.title}
                        </Link>
                        <p className="mt-0.5 font-body text-xs text-on-surface-variant">
                          Lot #{l.lotNumber ?? "—"}
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Status",
                  cell: (l) => {
                    const { label, tone } = lotDotStatusPresentation({
                      status: l.status,
                      winnerId: l.winnerId,
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
                  cell: (l) => {
                    const transitions = LOT_TRANSITION_OPTIONS[l.status];
                    return (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/lots/${l.id}`}>Open</Link>
                        </Button>
                        {canEditDraft ? (
                          <ConfirmActionButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            confirmTitle="Detach lot from sale?"
                            confirmBody="Detach this lot from the sale? It returns to inventory as a standalone draft lot."
                            confirmLabel="Detach"
                            tone="warning"
                            onConfirmed={() =>
                              run(() => adminDetachLotFromSaleResultAction(saleId, l.id))
                            }
                          >
                            Detach
                          </ConfirmActionButton>
                        ) : null}
                        {canManageAuction &&
                        transitions.includes("cancelled") &&
                        saleStatus !== "ended" &&
                        saleStatus !== "cancelled" ? (
                          <ConfirmActionButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            confirmTitle="Cancel lot"
                            confirmBody={`Cancel lot "${l.title}"?`}
                            confirmLabel="Cancel lot"
                            onConfirmed={() =>
                              run(() => adminCancelLotInSaleResultAction(saleId, l.id))
                            }
                          >
                            Cancel lot
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
                                  variant="secondary"
                                  disabled={pending}
                                  confirmTitle={`Mark as ${next}`}
                                  confirmBody={`Mark lot "${l.title}" as ${next}?`}
                                  confirmLabel={`Mark ${next}`}
                                  onConfirmed={() =>
                                    run(() => adminSetLotStatusResultAction(saleId, l.id, next))
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
          )}
          {lots.length === 0 ? (
            <div className="mt-3 space-y-2">
              <p className="font-body text-sm text-on-surface-variant">No lots attached yet.</p>
              {canEditDraft && saleStatus === "draft" ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/admin/sales/${saleId}/setup?step=lots`}>
                    Continue setup to add lots
                  </Link>
                </Button>
              ) : canAddLots && saleStatus !== "draft" ? (
                <Button variant="secondary" size="sm" asChild>
                  <a href="#add-lot-to-live-sale">Add new lot</a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {saleStatus === "cancelled" && returnEligible.length > 0 && canManageAuction ? (
        <div className="rounded-lg border border-shell-stroke bg-surface-container-lowest/40 p-4">
          <DisplayHeading as="h2" className="text-lg">
            Return lots to inventory
          </DisplayHeading>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {returnEligible.length} lot{returnEligible.length === 1 ? "" : "s"} can be returned to
            standalone draft inventory for reuse.
          </p>
          <ConfirmActionButton
            variant="secondary"
            size="sm"
            confirmTitle="Return eligible lots to inventory?"
            confirmBody="Each lot will be reset to draft and detached from this sale."
            confirmLabel="Return lots"
            onConfirmed={async () => {
              for (const lot of returnEligible) {
                const r = await adminReturnLotToInventoryResultAction(lot.id, {
                  reason: "Bulk return after sale cancellation",
                  confirmVoided: lot.status === "voided",
                });
                if (!r.ok) {
                  notify.error(`${lot.title}: ${r.error}`);
                  return;
                }
              }
              notify.success("Lots returned to inventory");
              router.refresh();
            }}
          >
            Return {returnEligible.length} lot{returnEligible.length === 1 ? "" : "s"}
          </ConfirmActionButton>
        </div>
      ) : null}

      {canEditDraft ? (
        <div>
          <DisplayHeading as="h2" className="text-xl">
            Attach existing lot
          </DisplayHeading>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {attachExistingLotPanelBody(isSaleroom)}
          </p>
          <div className="mt-4 max-w-xl">
            <AttachExistingLotReview
              saleId={saleId}
              saleWindow={{ deliveryMode, startTime: saleStartTime, endTime: saleEndTime }}
              disabled={pending}
              onAttached={() => router.refresh()}
            />
          </div>
        </div>
      ) : null}

      {canAddLots && saleStatus !== "draft" ? (
        <EmergencyAddLotPanel
          saleId={saleId}
          saleStatus={saleStatus}
          deliveryMode={deliveryMode}
          saleStartTime={saleStartTime}
          saleEndTime={saleEndTime}
          categories={categories}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        />
      ) : null}
    </div>
  );
}
