"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import type { ClerkActionPolicy } from "@/features/saleroom/types/clerk-console.types";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";

type Props = {
  saleId: string;
  canHammer: boolean;
  sessionLive: boolean;
  nextLot: Lot | null;
  policy: ClerkActionPolicy;
};

/**
 * The actions a clerk takes every lot, pinned to the bottom of the screen while the room is
 * running: bring the next lot up, then hammer or pass it. Hammer is the one primary action when
 * a lot is on the block; between lots it is Advance.
 */
export function ClerkLiveActionBar({ saleId, canHammer, sessionLive, nextLot, policy }: Props) {
  if (!sessionLive || (!policy.advanceInDock && !policy.hammerInDock)) return null;
  const hammerShown = policy.hammerInDock && canHammer;

  return (
    // `data-staff-bulk-bar` keeps the page's scroll clearance above the bar, so a focused
    // control is never hidden behind it.
    <div
      data-staff-bulk-bar=""
      className="pointer-events-none sticky bottom-4 z-20 flex justify-center"
    >
      <section
        aria-label="Lot actions"
        className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-staff-md border border-staff-line bg-staff-raised p-2 shadow-staff-md lg:flex-row lg:items-center"
      >
        {policy.advanceInDock && nextLot ? (
          <SaleroomPendingSubmit
            pendingLabel="Advancing…"
            variant={hammerShown ? "secondary" : "primary"}
            size="live"
            className="w-full lg:w-auto"
            disabled={!sessionLive}
            onRun={() => adminSaleroomAdvanceAction({ saleId, lotId: nextLot.id })}
          >
            Advance next ({formatLotRunListLabel(nextLot)})
          </SaleroomPendingSubmit>
        ) : null}
        {hammerShown ? (
          <LotOutcomeControls
            saleId={saleId}
            canHammer={canHammer}
            compact
            className="lg:shrink-0"
          />
        ) : null}
      </section>
    </div>
  );
}
