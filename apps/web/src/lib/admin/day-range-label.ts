const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function dayLabel(day: string): string {
  return DAY_LABEL.format(new Date(`${day}T00:00:00Z`));
}

/** A chosen range of calendar days (`YYYY-MM-DD`, either end optional) as a filter chip reads it. */
export function dayRangeLabel(from: string, to: string): string {
  if (from && to) return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
  return from ? `From ${dayLabel(from)}` : `Until ${dayLabel(to)}`;
}
