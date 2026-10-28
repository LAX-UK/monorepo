/**
 * When an edition counts as a new release. A work is new for a fixed window after it is first
 * listed; after that it is simply on sale. One rule, so the card tag, the hero date and the
 * "New editions" heading always agree.
 */
export const NEW_RELEASE_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseListedAt(listedAt: string | null | undefined): Date | null {
  if (!listedAt) return null;
  const date = new Date(listedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** True while the work is inside the new-release window; false without a listing date. */
export function isNewRelease(listedAt: string | null | undefined, now: Date): boolean {
  const listed = parseListedAt(listedAt);
  if (!listed) return false;
  const age = now.getTime() - listed.getTime();
  return age >= 0 && age < NEW_RELEASE_WINDOW_DAYS * DAY_MS;
}

const releaseDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "28 Oct 2026" in London time; null without a usable listing date. */
export function formatReleaseDate(listedAt: string | null | undefined): string | null {
  const listed = parseListedAt(listedAt);
  return listed ? releaseDateFormat.format(listed) : null;
}
