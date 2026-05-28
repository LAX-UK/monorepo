import type { LotTimerInputs } from "@/components/lot-timer/classify";
import type { LotStatus } from "@auction/types";

function toIsoTime(value: string | Date | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

/** Normalizes lot timing fields for timer/badge components. */
export function toLotTimerInputs(input: {
  status: LotStatus;
  startTime: string | Date | null;
  endTime: string | Date | null;
}): LotTimerInputs {
  return {
    status: input.status,
    startTime: toIsoTime(input.startTime),
    endTime: toIsoTime(input.endTime),
  };
}
