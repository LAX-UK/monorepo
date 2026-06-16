"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { useLotRunway } from "@/features/saleroom/hooks/use-lot-runway";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useEffect, useState } from "react";

type Props = {
  saleId: string;
  lots: Lot[];
  currentLotId: string | null;
  sessionLive?: boolean;
};

export function LotRunwayPanel({ saleId, lots, currentLotId, sessionLive = false }: Props) {
  const { orderedLots, nextLot, runway } = useLotRunway({ lots, currentLotId });
  const [advanceLotId, setAdvanceLotId] = useState(() => currentLotId ?? orderedLots[0]?.id ?? "");

  useEffect(() => {
    setAdvanceLotId(currentLotId ?? nextLot?.id ?? orderedLots[0]?.id ?? "");
  }, [currentLotId, nextLot?.id, orderedLots]);

  return (
    <div className="rounded-lg border border-outline-variant/25 p-4">
      <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Lot runway
      </h2>
      {orderedLots.length === 0 ? (
        <p className="mt-2 font-body text-sm text-secondary">No lots on this sale yet.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {runway.map(({ lot, label, isCurrent, isNext }) => (
              <li
                key={lot.id}
                className={`rounded-md px-3 py-2 font-body text-sm ${
                  isCurrent
                    ? "bg-primary/10 font-medium text-foreground"
                    : isNext
                      ? "bg-surface-container-low text-on-surface-variant"
                      : "text-secondary"
                }`}
              >
                {isCurrent ? "● " : isNext ? "→ " : "  "}
                {label}
              </li>
            ))}
          </ul>
          <form
            id={`saleroom-advance-${saleId}`}
            action={adminSaleroomAdvanceAction}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="saleId" value={saleId} />
            <input type="hidden" name="lotId" value={advanceLotId} />
            <div className="flex flex-col gap-1 font-body text-xs text-secondary">
              <Label htmlFor={`saleroom-advance-lot-${saleId}`}>Advance to lot</Label>
              <Select value={advanceLotId} onValueChange={setAdvanceLotId}>
                <SelectTrigger
                  id={`saleroom-advance-lot-${saleId}`}
                  className="min-w-[240px] font-body text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderedLots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {formatLotRunListLabel(l)}
                      {l.id === currentLotId ? " (on block)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SaleroomPendingSubmit
              formId={`saleroom-advance-${saleId}`}
              pendingLabel="Advancing…"
              variant="default"
              className="min-h-11"
              disabled={!sessionLive}
              aria-disabled={!sessionLive}
            >
              On the block
            </SaleroomPendingSubmit>
            {nextLot ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={!sessionLive}
                onClick={() => setAdvanceLotId(nextLot.id)}
              >
                Select next ({formatLotRunListLabel(nextLot)})
              </Button>
            ) : null}
          </form>
          {nextLot ? (
            <form
              id={`saleroom-advance-next-${saleId}`}
              action={adminSaleroomAdvanceAction}
              className="mt-2"
            >
              <input type="hidden" name="saleId" value={saleId} />
              <input type="hidden" name="lotId" value={nextLot.id} />
              <SaleroomPendingSubmit
                formId={`saleroom-advance-next-${saleId}`}
                pendingLabel="Advancing…"
                variant="default"
                className="min-h-11"
                disabled={!sessionLive}
                aria-disabled={!sessionLive}
              >
                Advance next
              </SaleroomPendingSubmit>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
