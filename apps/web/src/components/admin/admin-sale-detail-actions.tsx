"use client";

import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import {
  adminAttachLotToSaleResultAction,
  adminCancelLotInSaleResultAction,
  adminCancelSaleResultAction,
  adminDetachLotFromSaleResultAction,
  adminMarkSaleEndedResultAction,
  adminPublishSaleResultAction,
  adminSetLotStatusResultAction,
} from "@/lib/actions/admin-sales";
import type { ActionResult } from "@/lib/forms/form-result";
import type { LotStatus, SaleDeliveryMode, SaleStatus } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type LotRow = { id: string; title: string; lotNumber: number | null; status: LotStatus };

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  canEdit: boolean;
  canPublish: boolean;
  canCancel: boolean;
  canMarkOnsiteEnded: boolean;
  lots: LotRow[];
  draftOrphans: { id: string; title: string }[];
};

const LOT_TRANSITION_OPTIONS: Record<LotStatus, LotStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["cancelled"],
  active: ["ended", "cancelled"],
  ended: [],
  cancelled: [],
};

export function AdminSaleDetailActions({
  saleId,
  saleStatus,
  deliveryMode,
  canEdit,
  canPublish,
  canCancel,
  canMarkOnsiteEnded,
  lots,
  draftOrphans,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult<void>>) => {
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (r.ok) {
          toast.success("Done");
          router.refresh();
          return;
        }
        toast.error(r.error);
      })();
    });
  };

  const isOnsite = deliveryMode === "onsite";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Link
            href={`/admin/sales/${saleId}/edit`}
            className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
          >
            Edit draft
          </Link>
        ) : null}
        {canPublish ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => adminPublishSaleResultAction(saleId))}
          >
            Publish
          </Button>
        ) : null}
        {canMarkOnsiteEnded ? (
          <Button
            type="button"
            disabled={pending}
            variant="secondary"
            onClick={() => {
              if (!confirm("End this onsite sale and all of its remaining lots?")) return;
              run(() => adminMarkSaleEndedResultAction(saleId));
            }}
          >
            Mark onsite sale ended
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            disabled={pending}
            variant="secondary"
            onClick={() => {
              if (!confirm("Cancel the entire sale and remaining lots?")) return;
              run(() => adminCancelSaleResultAction(saleId));
            }}
          >
            Cancel sale
          </Button>
        ) : null}
        <Link
          href={`/sales/${saleId}`}
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
        >
          View on site
        </Link>
      </div>

      <div>
        <DisplayHeading as="h2" className="text-2xl">
          Catalog lots
        </DisplayHeading>
        <p className="mt-1 font-body text-xs text-on-surface-variant">
          {isOnsite
            ? "Onsite lots inherit the auction's start/end window."
            : "Online lots run on their own schedule and accept bids when active."}
        </p>
        <ul className="mt-4 divide-y divide-outline-variant/15 rounded-xl border border-outline-variant/15">
          {lots.map((l) => {
            const transitions = LOT_TRANSITION_OPTIONS[l.status];
            return (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-headline text-base">{l.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    Lot #{l.lotNumber ?? "—"} · {l.status}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <Button
                      type="button"
                      disabled={pending}
                      variant="secondary"
                      onClick={() => run(() => adminDetachLotFromSaleResultAction(saleId, l.id))}
                    >
                      Detach
                    </Button>
                  ) : null}
                  {transitions.includes("cancelled") &&
                  saleStatus !== "ended" &&
                  saleStatus !== "cancelled" ? (
                    <Button
                      type="button"
                      disabled={pending}
                      variant="secondary"
                      onClick={() => {
                        if (!confirm(`Cancel lot "${l.title}"?`)) return;
                        run(() => adminCancelLotInSaleResultAction(saleId, l.id));
                      }}
                    >
                      Cancel lot
                    </Button>
                  ) : null}
                  {transitions
                    .filter((t) => t !== "cancelled")
                    .map((next) => (
                      <Button
                        key={next}
                        type="button"
                        disabled={pending}
                        variant="secondary"
                        onClick={() => {
                          if (!confirm(`Mark lot "${l.title}" as ${next}?`)) return;
                          run(() => adminSetLotStatusResultAction(saleId, l.id, next));
                        }}
                      >
                        Mark {next}
                      </Button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {canEdit && draftOrphans.length > 0 ? (
        <div>
          <DisplayHeading as="h2" className="text-2xl">
            Attach draft lot
          </DisplayHeading>
          <p className="mt-2 text-sm text-on-surface-variant">
            Standalone draft lots only.{" "}
            {isOnsite
              ? "Their schedule will inherit the sale window."
              : "After attach, set schedule on the lot if needed."}
          </p>
          <ul className="mt-4 space-y-3">
            {draftOrphans.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/15 px-4 py-3"
              >
                <span className="font-body text-sm">{l.title}</span>
                <Button
                  type="button"
                  disabled={pending}
                  variant="secondary"
                  onClick={() => run(() => adminAttachLotToSaleResultAction(saleId, l.id))}
                >
                  Attach
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
