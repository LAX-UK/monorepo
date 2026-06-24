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
  const hammerFormId = `saleroom-hammer-${saleId}`;
  const noSaleFormId = `saleroom-nosale-${saleId}`;

  return (
    <div className={cn("space-y-2", className)}>
      {!compact ? <ConsoleSectionLabel>Lot outcome</ConsoleSectionLabel> : null}
      <div className="flex flex-wrap gap-2" aria-label="Lot outcome controls">
        <form id={hammerFormId} action={adminSaleroomHammerAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={hammerFormId}
            pendingLabel="Recording…"
            variant="default"
            className="min-h-11"
            disabled={!canHammer}
            aria-disabled={!canHammer}
          >
            Hammer (sold)
          </SaleroomPendingSubmit>
        </form>
        <form id={noSaleFormId} action={adminSaleroomNoSaleAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={noSaleFormId}
            pendingLabel="Recording…"
            variant="secondary"
            className="min-h-11"
            disabled={!canHammer}
            aria-disabled={!canHammer}
          >
            Pass (no sale)
          </SaleroomPendingSubmit>
        </form>
      </div>
      {!compact ? (
        <p className="font-body text-xs text-on-surface-variant">
          Use Pass when the reserve isn&apos;t met or the lot is withdrawn from the block.
        </p>
      ) : null}
    </div>
  );
}
