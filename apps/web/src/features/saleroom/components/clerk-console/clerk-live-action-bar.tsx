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

type DockProps = Props & {
  /** True when the form is empty and the reserve is met: Hammer is then the one primary action. */
  hammerPrimary?: boolean;
};

/**
 * The actions a clerk takes every lot, docked under the bid form in the Lot on block panel so
 * nothing sits beneath them: bring the next lot up, then hammer or pass it. Between lots the
 * one primary action is Advance; on the block it is Hammer only when it is the natural next
 * step (see `hammerPrimary`), so it never competes with Place paddle bid.
 */
export function ClerkLiveActionBar({
  saleId,
  canHammer,
  sessionLive,
  nextLot,
  policy,
  hammerPrimary = false,
}: DockProps) {
  if (!sessionLive || (!policy.advanceInDock && !policy.hammerInDock)) return null;
  const hammerShown = policy.hammerInDock && canHammer;

  return (
    <section
      aria-label="Lot actions"
      className="flex flex-wrap items-center gap-2 border-t border-staff-line-subtle pt-4"
    >
      {policy.advanceInDock && nextLot ? (
        <SaleroomPendingSubmit
          pendingLabel="Advancing…"
          variant={hammerShown ? "secondary" : "primary"}
          size="lg"
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
          hammerVariant={hammerPrimary ? "primary" : "secondary"}
        />
      ) : null}
    </section>
  );
}
