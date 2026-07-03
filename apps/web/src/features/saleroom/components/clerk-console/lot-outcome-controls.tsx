"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { ConsoleSectionLabel } from "@/features/saleroom/components/clerk-console/console-panel";
import { adminSaleroomHammerAction, adminSaleroomNoSaleAction } from "@/lib/actions/admin";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  saleId: string;
  canHammer: boolean;
  className?: string;
  compact?: boolean;
};

export function LotOutcomeControls({ saleId, canHammer, className, compact = false }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      {!compact ? <ConsoleSectionLabel>Lot outcome</ConsoleSectionLabel> : null}
      <div className="flex flex-wrap gap-2" aria-label="Lot outcome controls">
        <SaleroomPendingSubmit
          pendingLabel="Recording…"
          variant="default"
          className="min-h-11"
          disabled={!canHammer}
          aria-disabled={!canHammer}
          onRun={() => adminSaleroomHammerAction({ saleId })}
        >
          Hammer (sold)
        </SaleroomPendingSubmit>
        <SaleroomPendingSubmit
          pendingLabel="Recording…"
          variant="secondary"
          className="min-h-11"
          disabled={!canHammer}
          aria-disabled={!canHammer}
          onRun={() => adminSaleroomNoSaleAction({ saleId })}
        >
          Pass (no sale)
        </SaleroomPendingSubmit>
      </div>
      {!compact ? (
        <p className="font-body text-xs text-on-surface-variant">
          Use Pass when the reserve isn&apos;t met or the lot is withdrawn from the block.
        </p>
      ) : null}
    </div>
  );
}
