import { LONDON_TIME_ZONE, formatTime } from "@auction/datetime";
import { formatStaffCalendarDay } from "@auction/staff-ui";

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
  return formatTime(date, LONDON_TIME_ZONE);
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
