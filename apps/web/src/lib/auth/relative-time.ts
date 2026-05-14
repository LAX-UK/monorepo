const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** Human-readable relative time (e.g. "3 hours ago") for stable tests pass a fixed `now`. */
export function formatRelativeTime(iso: string, now: Date): string {
  let then: Date;
  try {
    then = new Date(iso);
    if (Number.isNaN(then.getTime())) return iso;
  } catch {
    return iso;
  }
  const diffSec = Math.round((then.getTime() - now.getTime()) / 1000);
  const absSec = Math.abs(diffSec);
  const sign = diffSec > 0 ? 1 : -1;

  if (absSec < 60) return rtf.format(sign * Math.round(diffSec), "second");
  if (absSec < 3600) return rtf.format(sign * Math.round(diffSec / 60), "minute");
  if (absSec < 86400) return rtf.format(sign * Math.round(diffSec / 3600), "hour");
  if (absSec < 86400 * 7) return rtf.format(sign * Math.round(diffSec / 86400), "day");
  if (absSec < 86400 * 30) return rtf.format(sign * Math.round(diffSec / (86400 * 7)), "week");
  if (absSec < 86400 * 365) return rtf.format(sign * Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(sign * Math.round(diffSec / (86400 * 365)), "year");
}
