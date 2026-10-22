const LONDON = "Europe/London";

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Staff read editorial times in London time wherever they sit, and pinning the zone keeps the
 * server-rendered text identical to what the browser renders on hydration.
 */
export function formatLondonTime(iso: string): string {
  const date = parse(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: LONDON,
  }).format(date);
}

export function formatLondonDateTime(iso: string): string {
  const date = parse(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: LONDON,
  }).format(date);
}

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Exhibition dates are calendar days with no time, so they are read in UTC to avoid a day shift. */
export function formatCalendarDay(value: string): string {
  const date = parse(`${value.slice(0, 10)}T00:00:00Z`);
  return date ? DAY.format(date) : value;
}

export function formatDateRange(startsOn: string | null, endsOn: string | null): string | null {
  if (startsOn && endsOn) return `${formatCalendarDay(startsOn)} – ${formatCalendarDay(endsOn)}`;
  if (startsOn) return `From ${formatCalendarDay(startsOn)}`;
  if (endsOn) return `Until ${formatCalendarDay(endsOn)}`;
  return null;
}
