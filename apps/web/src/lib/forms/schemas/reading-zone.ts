import { DEFAULT_SALE_TIME_ZONE, saleTimeZoneProblem } from "@auction/validators";

/**
 * The zone a form's typed wall-clock times are read in: the sale's zone, or London while the
 * value is not a usable one (a blank, or a name that is not a place). A bad zone is reported on
 * the time zone field itself; the times next to it are still read, so one mistake does not hide
 * every other message.
 */
export function readingZone(timeZone: string | null | undefined): string {
  return saleTimeZoneProblem(timeZone) ? DEFAULT_SALE_TIME_ZONE : (timeZone as string);
}
