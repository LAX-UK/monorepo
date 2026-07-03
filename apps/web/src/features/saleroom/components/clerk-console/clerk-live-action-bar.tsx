"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import type { ClerkActionPolicy } from "@/features/saleroom/types/clerk-console.types";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  saleId: string;
  canHammer: boolean;
  sessionLive: boolean;
  nextLot: Lot | null;
  policy: ClerkActionPolicy;
};

export function ClerkLiveActionBar({ saleId, canHammer, sessionLive, nextLot, policy }: Props) {
  if (!sessionLive || (!policy.advanceInDock && !policy.hammerInDock)) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant/25 bg-surface-container-low/95 shadow-lg backdrop-blur-sm",
        "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-4xl gap-2",
          "flex-col lg:flex-row lg:items-center lg:justify-end",
        )}
      >
        {policy.advanceInDock && nextLot ? (
          <SaleroomPendingSubmit
            pendingLabel="Advancing…"
            variant="outline"
            className="min-h-11 w-full lg:max-w-sm lg:flex-1"
            disabled={!sessionLive}
            aria-disabled={!sessionLive}
            onRun={() => adminSaleroomAdvanceAction({ saleId, lotId: nextLot.id })}
          >
            Advance next ({formatLotRunListLabel(nextLot)})
          </SaleroomPendingSubmit>
        ) : null}
        {policy.hammerInDock && canHammer ? (
          <LotOutcomeControls
            saleId={saleId}
            canHammer={canHammer}
            compact
            className="lg:shrink-0"
          />
        ) : null}
      </div>
    </div>
  );
}
