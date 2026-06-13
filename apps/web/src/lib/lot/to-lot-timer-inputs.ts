import type { LotTimerInputs } from "@/components/lot-timer/classify";
import type { LotCardTimingVM, LotTimingSource } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

/** Normalizes lot timing fields for timer/badge components. */
export function toLotTimerInputs(source: LotTimingSource): LotTimerInputs {
  return toLotCardTimingVM(source);
}

/** @deprecated Prefer `toLotCardTimingVM` at the VM boundary; use this only for raw lot records. */
export function toLotTimerInputsFromLot(lot: LotTimingSource): LotTimerInputs {
  return toLotCardTimingVM(lot);
}

/** Pass-through when timing is already normalized on a view model. */
export function lotCardTimingToTimerInputs(timing: LotCardTimingVM): LotTimerInputs {
  return timing;
}
