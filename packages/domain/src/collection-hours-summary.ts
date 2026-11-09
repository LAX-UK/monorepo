import type { CollectionWeeklyHours } from "./collection-calendar.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function joinWords(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Consecutive weekdays as runs: [1,2,3,5] is "Monday to Wednesday and Friday". */
function describeDays(weekdays: readonly number[]): string {
  const runs: number[][] = [];
  for (const day of weekdays) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === day - 1) last.push(day);
    else runs.push([day]);
  }
  return joinWords(
    runs.map((run) => {
      const first = WEEKDAYS[(run[0] ?? 1) - 1];
      const last = WEEKDAYS[(run[run.length - 1] ?? 1) - 1];
      if (run.length === 1) return `${first}`;
      return run.length === 2 ? `${first} and ${last}` : `${first} to ${last}`;
    }),
  );
}

/**
 * The weekly hours in a sentence for a buyer: "Monday to Friday, 10:00 to 19:00". Days with the
 * same hours are grouped; a day with two ranges reads "10:00 to 13:00 and 14:00 to 19:00". Returns
 * `null` when the place is never open.
 */
export function summariseWeeklyHours(hours: readonly CollectionWeeklyHours[]): string | null {
  const bySignature = new Map<string, number[]>();
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const ranges = hours
      .filter((h) => h.weekday === weekday)
      .sort((a, b) => a.opensLocal.localeCompare(b.opensLocal))
      .map((h) => `${h.opensLocal} to ${h.closesLocal}`);
    if (ranges.length === 0) continue;
    const signature = joinWords(ranges);
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), weekday]);
  }
  if (bySignature.size === 0) return null;
  return [...bySignature.entries()]
    .map(([signature, days]) => `${describeDays(days)}, ${signature}`)
    .join("; ");
}
