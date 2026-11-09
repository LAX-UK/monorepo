import { formatDayMonth, formatTimeWithZone, formatWeekday, formatWhen } from "./date-style.js";
import { type LocalTime, localTimeAt } from "./local-time.js";
import { spokenLocalTime } from "./spoken.js";

/**
 * How much of the official moment to print: `full` "Thu 12 Nov, 18:00 GMT" (the one date style),
 * `time` "18:00 GMT" (a sub line under a day already shown), `short` "Thu 12 Nov" (the day alone).
 */
export type MomentForm = "full" | "time" | "short";

export type DescribeMomentInput = {
  officialZone: string;
  /** The device or Account zone; anything unusable simply yields no local line. */
  viewerZone?: string | null;
  now: Date;
  form?: MomentForm;
};

export type MomentDescription = {
  /** The sale's own clock, always present. */
  official: string;
  /** The visitor's clock, or `null` when it would add nothing. */
  local: LocalTime | null;
  localDiffersDay: boolean;
  dayRelation: "same" | "next" | "previous";
  /** The screen-reader sentence for the local line, or `null` with it. */
  spoken: string | null;
  /** The instant in UTC, for `<time datetime>`. */
  iso: string;
};

const DAY_RELATION = { "-1": "previous", "0": "same", "1": "next" } as const;

function officialLine(instant: Date, zone: string, now: Date, form: MomentForm): string {
  if (form === "time") return formatTimeWithZone(instant, zone);
  if (form === "short")
    return `${formatWeekday(instant, zone)} ${formatDayMonth(instant, zone, now)}`;
  return formatWhen(instant, zone, now);
}

/** One formatter for every surface: the official line plus, when it differs, the visitor's own. */
export function describeMoment(
  instant: Date,
  { officialZone, viewerZone, now, form = "full" }: DescribeMomentInput,
): MomentDescription {
  const local = localTimeAt(instant, officialZone, viewerZone, now);
  return {
    official: officialLine(instant, officialZone, now, form),
    local,
    localDiffersDay: local !== null && local.dayShift !== 0,
    dayRelation: local ? DAY_RELATION[String(local.dayShift) as keyof typeof DAY_RELATION] : "same",
    spoken: local ? spokenLocalTime(instant, local) : null,
    iso: instant.toISOString(),
  };
}
