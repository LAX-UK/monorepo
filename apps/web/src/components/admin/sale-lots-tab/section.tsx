"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AttachExistingLotReview } from "@/components/admin/attach-existing-lot-review";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { MediaImage } from "@/components/ui/media-image";
import { DisplayHeading } from "@/components/ui/typography";
import { adminReturnLotToInventoryResultAction } from "@/lib/actions/admin";
import {
  adminCancelLotInSaleResultAction,
  adminDetachLotFromSaleResultAction,
  adminSetLotStatusResultAction,
} from "@/lib/actions/admin-sales";
import { attachExistingLotPanelBody } from "@/lib/admin/sale-setup";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import type { LotStatus, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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
  canEdit: boolean;
  canManageAuction?: boolean;
  lots: SaleLotsTabLotRow[];
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
  canEdit,
  canManageAuction = false,
  lots,
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
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-sm text-on-surface-variant">
            {lots.length} lot{lots.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-1 rounded-lg border border-border-hairline p-0.5">
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

        {view === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lots.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/admin/lots/${l.id}`}
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-lg border border-border-hairline",
                    "bg-surface-container-lowest/40 transition-colors hover:border-link/30 hover:bg-primary/5",
                  )}
                >
                  <div className="relative aspect-square bg-surface-container-low">
                    {l.imageUrl ? (
                      <MediaImage
                        src={l.imageUrl}
                        alt={l.title}
                        label={l.title}
                        imgClassName="object-cover"
                        sizes="(max-width: 640px) 50vw, 200px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-on-surface-variant">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="line-clamp-2 font-headline text-sm text-on-surface">{l.title}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span>Lot #{l.lotNumber ?? "—"}</span>
                      <AdminStatusBadge domain="lot" status={l.status} />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline bg-surface-container-lowest/40">
            {lots.map((l) => {
              const transitions = LOT_TRANSITION_OPTIONS[l.status];
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/lots/${l.id}`}
                      className="font-headline text-base text-on-surface hover:text-link"
                    >
                      {l.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span>Lot #{l.lotNumber ?? "—"}</span>
                      <AdminStatusBadge domain="lot" status={l.status} />
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/lots/${l.id}`}>Open</Link>
                    </Button>
                    {canEdit ? (
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
                </li>
              );
            })}
          </ul>
        )}
        {lots.length === 0 ? (
          <div className="mt-3 space-y-2">
            <p className="font-body text-sm text-on-surface-variant">No lots attached yet.</p>
            {canEdit && saleStatus === "draft" ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/admin/sales/${saleId}/setup?step=lots`}>
                  Continue setup to add lots
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {saleStatus === "cancelled" && returnEligible.length > 0 && canManageAuction ? (
        <div className="rounded-lg border border-border-hairline bg-surface-container-lowest/40 p-4">
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

      {canEdit ? (
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
    </div>
  );
}
