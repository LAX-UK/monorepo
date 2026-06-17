"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { type LotRunwayRow, useLotRunway } from "@/features/saleroom/hooks/use-lot-runway";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import { isLotAdvanceable } from "@/lib/saleroom/lot-run-progress";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { formatMoney } from "@/lib/ui/format";
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
import { Check, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  saleId: string;
  lots: Lot[];
  currentLotId: string | null;
  sessionLive?: boolean;
  sessionStatus?: PublicSaleroomSessionStatus["status"];
};

function RunwayRow({ row }: { row: LotRunwayRow }) {
  const { lot, label, outcome, isCurrent, isNext } = row;

  let rowClass = "rounded-md px-3 py-2 font-body text-sm transition-colors duration-200 ";
  if (isCurrent) {
    rowClass += "bg-primary/10 font-medium text-foreground ring-1 ring-primary/20";
  } else if (isNext) {
    rowClass += "border border-outline-variant/30 bg-surface-container-low text-on-surface";
  } else if (outcome === "sold") {
    rowClass += "text-secondary opacity-80";
  } else if (outcome === "no_sale" || outcome === "skipped") {
    rowClass += "text-secondary opacity-60";
  } else {
    rowClass += "text-on-surface-variant";
  }

  const prefix = isCurrent ? "● " : isNext ? "→ " : "  ";

  return (
    <li className={rowClass} data-lot-id={lot.id} data-current={isCurrent ? "true" : undefined}>
      <span className="flex items-center justify-between gap-2">
        <span>
          {prefix}
          {label}
        </span>
        {outcome === "sold" ? (
          <span className="flex items-center gap-1 text-xs tabular-nums">
            <Check className="size-3.5 shrink-0" aria-hidden />
            {formatMoney(lot.currentPrice)}
          </span>
        ) : outcome === "no_sale" ? (
          <span className="flex items-center gap-1 text-xs">
            <Minus className="size-3.5 shrink-0" aria-hidden />
            No sale
          </span>
        ) : null}
      </span>
    </li>
  );
}

export function LotRunwayPanel({
  saleId,
  lots,
  currentLotId,
  sessionLive = false,
  sessionStatus = "none",
}: Props) {
  const { orderedLots, nextLot, runway, progress } = useLotRunway({
    lots,
    currentLotId,
    sessionStatus,
  });
  const [advanceLotId, setAdvanceLotId] = useState(
    () => currentLotId ?? nextLot?.id ?? orderedLots.find(isLotAdvanceable)?.id ?? "",
  );
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setAdvanceLotId(currentLotId ?? nextLot?.id ?? orderedLots.find(isLotAdvanceable)?.id ?? "");
  }, [currentLotId, nextLot?.id, orderedLots]);

  useEffect(() => {
    if (!currentLotId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-current="true"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentLotId]);

  const advanceableLots = orderedLots.filter(isLotAdvanceable);

  return (
    <ConsolePanel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelHeading>Lot runway</PanelHeading>
        {progress.totalLots > 0 ? (
          <p className="font-body text-xs text-secondary">
            {progress.completedLots} of {progress.totalLots} complete · {progress.remainingLots}{" "}
            remaining
          </p>
        ) : null}
      </div>

      {orderedLots.length === 0 ? (
        <p className="mt-2 font-body text-sm text-secondary">No lots on this sale yet.</p>
      ) : (
        <>
          <ul ref={listRef} className="mt-3 max-h-[min(420px,50vh)] space-y-1 overflow-y-auto pr-1">
            {runway.map((row) => (
              <RunwayRow key={row.lot.id} row={row} />
            ))}
          </ul>

          {nextLot && sessionLive && !progress.betweenLots ? (
            <form
              id={`saleroom-advance-next-${saleId}`}
              action={adminSaleroomAdvanceAction}
              className="mt-4"
            >
              <input type="hidden" name="saleId" value={saleId} />
              <input type="hidden" name="lotId" value={nextLot.id} />
              <SaleroomPendingSubmit
                formId={`saleroom-advance-next-${saleId}`}
                pendingLabel="Advancing…"
                variant="default"
                className="min-h-11 w-full sm:w-auto"
                disabled={!sessionLive}
                aria-disabled={!sessionLive}
              >
                Advance next ({formatLotRunListLabel(nextLot)})
              </SaleroomPendingSubmit>
            </form>
          ) : null}

          <form
            id={`saleroom-advance-${saleId}`}
            action={adminSaleroomAdvanceAction}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="saleId" value={saleId} />
            <input type="hidden" name="lotId" value={advanceLotId} />
            <div className="flex flex-col gap-1 font-body text-xs text-secondary">
              <Label htmlFor={`saleroom-advance-lot-${saleId}`}>Jump to lot</Label>
              <Select value={advanceLotId} onValueChange={setAdvanceLotId}>
                <SelectTrigger
                  id={`saleroom-advance-lot-${saleId}`}
                  className="min-w-[240px] font-body text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {advanceableLots.map((l) => (
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
              variant="outline"
              className="min-h-11"
              disabled={!sessionLive || advanceableLots.length === 0}
              aria-disabled={!sessionLive}
            >
              On the block
            </SaleroomPendingSubmit>
            {nextLot ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={!sessionLive}
                onClick={() => setAdvanceLotId(nextLot.id)}
              >
                Select next
              </Button>
            ) : null}
          </form>
        </>
      )}
    </ConsolePanel>
  );
}
