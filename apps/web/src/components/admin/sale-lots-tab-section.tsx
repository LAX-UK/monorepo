"use client";

import { DisplayHeading } from "@/components/ui/typography";
import {
  adminAttachLotToSaleResultAction,
  adminCancelLotInSaleResultAction,
  adminDetachLotFromSaleResultAction,
  adminSetLotStatusResultAction,
} from "@/lib/actions/admin-sales";
import { lotStatusLabel, lotStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import type { LotStatus, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { StatusBadge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export type SaleLotsTabLotRow = {
  id: string;
  title: string;
  lotNumber: number | null;
  status: LotStatus;
};

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  canEdit: boolean;
  lots: SaleLotsTabLotRow[];
  draftOrphans: { id: string; title: string }[];
};

const LOT_TRANSITION_OPTIONS: Record<LotStatus, LotStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["cancelled"],
  active: ["ended", "cancelled"],
  ended: [],
  cancelled: [],
  voided: [],
};

export function SaleLotsTabSection({
  saleId,
  saleStatus,
  deliveryMode,
  canEdit,
  lots,
  draftOrphans,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isOnsite = deliveryMode === "onsite";

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
        <DisplayHeading as="h2" className="text-xl">
          Catalog lots
        </DisplayHeading>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          {isOnsite
            ? "Onsite lots inherit the sale's start/end window."
            : "Online lots run on their own schedule and accept bids when active."}
        </p>
        <ul className="mt-4 divide-y divide-outline-variant/15 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/40">
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
                    className="font-headline text-base text-on-surface hover:text-primary"
                  >
                    {l.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span>Lot #{l.lotNumber ?? "—"}</span>
                    <StatusBadge variant={lotStatusToBadgeVariant(l.status)}>
                      {lotStatusLabel[l.status] ?? l.status}
                    </StatusBadge>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/lots/${l.id}`}>Open</Link>
                  </Button>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
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
                      size="sm"
                      variant="secondary"
                      disabled={pending}
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
                        size="sm"
                        variant="secondary"
                        disabled={pending}
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
        {lots.length === 0 ? (
          <p className="mt-3 font-body text-sm text-on-surface-variant">No lots attached yet.</p>
        ) : null}
      </div>

      {canEdit && draftOrphans.length > 0 ? (
        <div>
          <DisplayHeading as="h2" className="text-xl">
            Attach draft lot
          </DisplayHeading>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            Standalone draft lots only.{" "}
            {isOnsite
              ? "Their schedule will inherit the sale window."
              : "After attach, set schedule on the lot if needed."}
          </p>
          <ul className="mt-4 space-y-3">
            {draftOrphans.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/40 px-4 py-3"
              >
                <span className="font-body text-sm">{l.title}</span>
                <Button
                  type="button"
                  size="sm"
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
    </div>
  );
}
