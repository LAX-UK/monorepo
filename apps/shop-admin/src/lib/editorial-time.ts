import { formatStaffCalendarDay } from "@auction/staff-ui";

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

/** Exhibition dates are calendar days with no time; midday UTC keeps them on that London date. */
export function formatCalendarDay(value: string): string {
  return parse(`${value.slice(0, 10)}T12:00:00Z`) ? formatStaffCalendarDay(value) : value;
}

export function formatDateRange(startsOn: string | null, endsOn: string | null): string | null {
  if (startsOn && endsOn) return `${formatCalendarDay(startsOn)} – ${formatCalendarDay(endsOn)}`;
  if (startsOn) return `From ${formatCalendarDay(startsOn)}`;
  if (endsOn) return `Until ${formatCalendarDay(endsOn)}`;
  return null;
}
