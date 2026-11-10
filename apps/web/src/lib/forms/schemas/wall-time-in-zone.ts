import { formatDayMonth } from "@auction/datetime";
import { nextExistingWallTime, wallTimeToIso } from "@auction/staff-ui";

/**
 * Staff cannot schedule a time the clocks skip. For a typed "YYYY-MM-DDTHH:mm" wall time in
 * `zone`, the message that says so and names the first time that works, or null when the time
 * exists (or the text is not a date and time at all; other rules report that).
 */
export function missingWallTimeMessage(raw: string, zone: string): string | null {
  const [day, time] = raw.trim().split("T");
  if (!day || !time) return null;
  const clock = time.slice(0, 5);
  if (wallTimeToIso(day, clock, zone) !== null) return null;
  const next = nextExistingWallTime(day, clock, zone);
  if (!next) return null;
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return `That time doesn't exist on ${formatDayMonth(date, "UTC", date)} because the clocks go forward. Choose ${next} or later.`;
}
