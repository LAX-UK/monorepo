"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { type LotRunwayRow, useLotRunway } from "@/features/saleroom/hooks/use-lot-runway";
import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";
import type { ClerkActionPolicy } from "@/features/saleroom/types/clerk-console.types";
import { adminSaleroomAdvanceAction } from "@/lib/actions/admin";
import { staffRunwayLotStatus } from "@/lib/admin/staff-kit-status";
import { lotChargeCurrency } from "@/lib/money/currency";
import { isLotAdvanceable } from "@/lib/saleroom/lot-run-progress";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { EnumSelect, Field, StaffButton, StatusBadge, cn } from "@auction/staff-ui";
import type { Lot } from "@auction/types";
import { useEffect, useRef, useState } from "react";

type Props = {
  saleId: string;
  lots: Lot[];
  currentLotId: string | null;
  sessionLive?: boolean;
  sessionStatus?: PublicSaleroomSessionStatus["status"];
  policy: ClerkActionPolicy;
  betweenLots?: boolean;
  nextLot?: Lot | null;
  hammeredLotIds: ReadonlySet<string>;
};

/** Each outcome reads as its own word, never only as a colour: sold, passed or withdrawn. */
function RunwayRow({ row, paused }: { row: LotRunwayRow; paused: boolean }) {
  const { lot, label, outcome, isCurrent, isNext } = row;
  const status = staffRunwayLotStatus(isCurrent ? "on_block" : isNext ? "next" : outcome);
  const done = outcome === "sold" || outcome === "no_sale" || outcome === "skipped";

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 rounded-staff-sm px-3 py-2 text-staff-sm",
        isCurrent ? "bg-staff-selected font-medium text-staff-fg" : "text-staff-fg",
        done && !isCurrent && "text-staff-muted",
      )}
      data-lot-id={lot.id}
      data-current={isCurrent ? "true" : undefined}
      aria-current={isCurrent ? "true" : undefined}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {outcome === "sold" ? (
          <span className="tabular-nums">
            {formatSaleroomMoney(lot.currentPrice, lotChargeCurrency(lot))}
          </span>
        ) : null}
        {status ? (
          <StatusBadge
            tone={paused && isCurrent ? "warning" : status.tone}
            live={!(paused && isCurrent) && (status.live ?? false)}
          >
            {status.label}
          </StatusBadge>
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
  policy,
  betweenLots = false,
  nextLot: nextLotProp = null,
  hammeredLotIds,
}: Props) {
  const {
    orderedLots,
    nextLot: nextLotFromHook,
    runway,
    progress,
  } = useLotRunway({
    lots,
    currentLotId,
    sessionStatus,
    hammeredLotIds,
  });
  const nextLot = nextLotProp ?? nextLotFromHook;
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
          <p className="text-staff-sm text-staff-muted tabular-nums">
            {progress.completedLots} of {progress.totalLots} complete · {progress.remainingLots}{" "}
            remaining
          </p>
        ) : null}
      </div>

      {orderedLots.length === 0 ? (
        <p className="mt-2 text-staff-sm text-staff-muted">No lots on this sale yet.</p>
      ) : (
        <>
          <ul
            ref={listRef}
            // The list scrolls on its own, so a keyboard has to be able to reach it.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
            tabIndex={0}
            aria-label="Lots in run order"
            className="staff-focus mt-3 flex max-h-[min(420px,50vh)] flex-col gap-0.5 overflow-y-auto rounded-staff-sm"
          >
            {runway.map((row) => (
              <RunwayRow key={row.lot.id} row={row} paused={sessionStatus === "paused"} />
            ))}
          </ul>

          {policy.advanceInRunway && nextLot && !betweenLots ? (
            <div className="mt-4">
              <SaleroomPendingSubmit
                pendingLabel="Advancing…"
                variant="primary"
                size="lg"
                disabled={!sessionLive}
                onRun={() => adminSaleroomAdvanceAction({ saleId, lotId: nextLot.id })}
              >
                Advance next ({formatLotRunListLabel(nextLot)})
              </SaleroomPendingSubmit>
            </div>
          ) : null}

          {policy.jumpToLotInRunway ? (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Field label="Jump to lot" className="w-full sm:w-72">
                <EnumSelect
                  size="lg"
                  value={advanceLotId || null}
                  onValueChange={setAdvanceLotId}
                  options={advanceableLots.map((l) => ({
                    value: l.id,
                    label: `${formatLotRunListLabel(l)}${l.id === currentLotId ? " (on the block)" : ""}`,
                  }))}
                />
              </Field>
              <SaleroomPendingSubmit
                pendingLabel="Advancing…"
                variant="secondary"
                size="lg"
                disabled={!sessionLive || advanceableLots.length === 0}
                onRun={() => adminSaleroomAdvanceAction({ saleId, lotId: advanceLotId })}
              >
                Put on the block
              </SaleroomPendingSubmit>
              {nextLot ? (
                <StaffButton
                  variant="ghost"
                  size="lg"
                  disabled={!sessionLive}
                  onClick={() => setAdvanceLotId(nextLot.id)}
                >
                  Select next lot
                </StaffButton>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </ConsolePanel>
  );
}
