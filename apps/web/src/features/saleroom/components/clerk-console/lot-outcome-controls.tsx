"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { ConsoleSectionLabel } from "@/features/saleroom/components/clerk-console/console-panel";
import { adminSaleroomHammerAction, adminSaleroomNoSaleAction } from "@/lib/actions/admin";
import { cn } from "@auction/staff-ui";

type Props = {
  saleId: string;
  canHammer: boolean;
  className?: string;
  compact?: boolean;
};

/** Ends the lot on the block: hammer it as sold, or pass it with no sale. */
export function LotOutcomeControls({ saleId, canHammer, className, compact = false }: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!compact ? <ConsoleSectionLabel>Lot outcome</ConsoleSectionLabel> : null}
      <div className="flex flex-wrap gap-2">
        <SaleroomPendingSubmit
          pendingLabel="Recording…"
          variant="primary"
          size="live"
          disabled={!canHammer}
          onRun={() => adminSaleroomHammerAction({ saleId })}
        >
          Hammer (sold)
        </SaleroomPendingSubmit>
        <SaleroomPendingSubmit
          pendingLabel="Recording…"
          variant="secondary"
          size="live"
          disabled={!canHammer}
          onRun={() => adminSaleroomNoSaleAction({ saleId })}
        >
          Pass (no sale)
        </SaleroomPendingSubmit>
      </div>
      {!compact ? (
        <p className="text-staff-xs text-staff-muted">
          Pass when the reserve isn&apos;t met or the lot is withdrawn from the block.
        </p>
      ) : null}
    </div>
  );
}
