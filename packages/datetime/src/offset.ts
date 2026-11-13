import { zoneOffsetMinutes } from "./zone-offset.js";

/** Minutes east of UTC that `zone` is on at `instant` (London in summer: 60). */
export function offsetMinutes(instant: Date, zone: string): number {
  return zoneOffsetMinutes(zone, instant);
}

/** True when both zones show the same clock at that instant, whatever their names. */
export function sameOffset(instant: Date, a: string, b: string): boolean {
  return offsetMinutes(instant, a) === offsetMinutes(instant, b);
}

/** "GMT", "GMT+11", "GMT−5" or "GMT+5:30": the offset alone, for a place that names no short zone. */
export function gmtOffsetLabel(instant: Date, zone: string): string {
  const minutes = offsetMinutes(instant, zone);
  if (minutes === 0) return "GMT";
  const sign = minutes < 0 ? "−" : "+";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}
