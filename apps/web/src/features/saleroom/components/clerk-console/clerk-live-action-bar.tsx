"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  saleId: string;
  canHammer: boolean;
  sessionLive: boolean;
  nextLot: Lot | null;
};

export function ClerkLiveActionBar({ saleId, canHammer, sessionLive, nextLot }: Props) {
  if (!sessionLive || (!canHammer && !nextLot)) return null;

  const advanceFormId = `saleroom-advance-next-bar-${saleId}`;

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
          "flex-col md:flex-row md:items-center md:justify-end",
        )}
      >
        {nextLot ? (
          <form
            id={advanceFormId}
            action={adminSaleroomAdvanceAction}
            className="md:flex-1 md:max-w-sm"
          >
            <input type="hidden" name="saleId" value={saleId} />
            <input type="hidden" name="lotId" value={nextLot.id} />
            <SaleroomPendingSubmit
              formId={advanceFormId}
              pendingLabel="Advancing…"
              variant="outline"
              className="min-h-11 w-full"
              disabled={!sessionLive}
              aria-disabled={!sessionLive}
            >
              Advance next ({formatLotRunListLabel(nextLot)})
            </SaleroomPendingSubmit>
          </form>
        ) : null}
        {canHammer ? (
          <LotOutcomeControls
            saleId={saleId}
            canHammer={canHammer}
            compact
            className="md:shrink-0"
          />
        ) : null}
      </div>
    </div>
  );
}
