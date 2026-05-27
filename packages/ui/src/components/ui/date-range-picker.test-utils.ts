import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { toDateFormString } from "../../lib/datetime/index.js";
import type { DateRangePreset } from "./date-range-picker.js";

export type { DateRangePreset };

function toYmd(d: Date, zone: string): string {
  return toDateFormString(d, zone);
}

/** Mirrors preset math from DateRangePicker for unit tests. */
export function applyPresetForTest(
  preset: DateRangePreset,
  zone: string,
): { from: string; to: string } {
  const end = new TZDate(new Date(), zone);
  const endInstant = new Date(end.getTime());
  if (preset === "today") {
    const ymd = toYmd(endInstant, zone);
    return { from: ymd, to: ymd };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 30;
  const start = addDays(new TZDate(endInstant, zone), -(days - 1));
  return { from: toYmd(new Date(start.getTime()), zone), to: toYmd(endInstant, zone) };
}
