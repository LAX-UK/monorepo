import { LONDON_TIME_ZONE, formatTimeUnpadded, formatWeekdayDate } from "@auction/datetime";

export function formatEventDateLondon(startsAt: Date): string {
  return formatWeekdayDate(startsAt, LONDON_TIME_ZONE);
}

export function formatEventDoorsTimeLondon(startsAt: Date): string {
  return `Doors ${formatTimeUnpadded(startsAt, LONDON_TIME_ZONE)}`;
}

export function formatEventDateTimeLondon(iso: string | null): string | null {
  if (!iso) return null;
  const startsAt = new Date(iso);
  if (Number.isNaN(startsAt.getTime())) return null;
  return `${formatEventDateLondon(startsAt)} · ${formatEventDoorsTimeLondon(startsAt).replace(/^Doors /, "")}`;
}
