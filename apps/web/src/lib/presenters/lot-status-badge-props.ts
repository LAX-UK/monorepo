import type { LotTimerInputs } from "@/components/lot-timer/classify";
import { lotCardTimingToTimerInputs } from "@/lib/lot/to-lot-timer-inputs";
import type { Lot, LotCardTimingVM, LotStatus } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

export type LotStatusBadgeInputs = LotTimerInputs & {
  winnerId?: string | null | undefined;
};

export type LotStatusBadgeSource = {
  status: LotStatus;
  startTime: Lot["startTime"] | LotCardTimingVM["startTime"];
  endTime: Lot["endTime"] | LotCardTimingVM["endTime"];
  winnerId?: string | null | undefined;
};

/** Lot VM → timer inputs + winnerId for `LotStatusBadge`. */
export function lotStatusBadgeProps(lot: LotStatusBadgeSource): LotStatusBadgeInputs {
  const timingSource: LotCardTimingVM =
    lot.startTime instanceof Date
      ? toLotCardTimingVM({
          status: lot.status,
          startTime: lot.startTime,
          endTime: lot.endTime instanceof Date ? lot.endTime : lot.endTime,
        })
      : {
          status: lot.status,
          startTime: lot.startTime,
          endTime: lot.endTime as string | null,
        };

  const timing = lotCardTimingToTimerInputs(timingSource);
  return lot.winnerId !== undefined ? { ...timing, winnerId: lot.winnerId } : timing;
}
