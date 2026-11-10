import { tzOffset } from "@date-fns/tz";

/** Minutes east of UTC that `zone` is on at `instant` (London in summer: 60). */
export function offsetMinutes(instant: Date, zone: string): number {
  return tzOffset(zone, instant);
}

/** True when both zones show the same clock at that instant, whatever their names. */
export function sameOffset(instant: Date, a: string, b: string): boolean {
  return offsetMinutes(instant, a) === offsetMinutes(instant, b);
}
