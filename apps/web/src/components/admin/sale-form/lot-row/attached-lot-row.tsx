"use client";

import type { SaleSetupLotRowFormValues } from "@/lib/admin/sale-setup";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { CheckCircle2, Trash2 } from "lucide-react";

type AttachedLotRowProps = {
  row: SaleSetupLotRowFormValues;
  rowIndex: number;
  readOnly: boolean;
  pending: boolean;
  detachConfirmOpen: boolean;
  onDetachConfirmOpenChange: (open: boolean) => void;
  onDetach: () => void;
};

export function AttachedLotRow({
  row,
  rowIndex,
  readOnly,
  pending,
  detachConfirmOpen,
  onDetachConfirmOpenChange,
  onDetach,
}: AttachedLotRowProps) {
  return (
    <>
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-headline text-base text-on-surface">
            Lot {rowIndex + 1}
            <span className="ml-2 inline-flex items-center gap-1 font-body text-xs text-primary">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Attached
            </span>
          </p>
          {!readOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDetachConfirmOpenChange(true)}
              disabled={pending}
              aria-label="Detach lot from sale"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
        <p className="font-body text-sm text-on-surface">{row.title || "Existing lot"}</p>
        <p className="mt-1 font-body text-xs text-on-surface-variant">
          Existing inventory lot attached to this sale.
        </p>
      </div>
      <ConfirmDialog
        open={detachConfirmOpen}
        onOpenChange={onDetachConfirmOpenChange}
        title="Detach lot from sale?"
        body="Detach this lot from the sale? It returns to inventory as a standalone draft lot."
        confirmLabel="Detach"
        tone="warning"
        loading={pending}
        onConfirm={onDetach}
      />
    </>
  );
}
