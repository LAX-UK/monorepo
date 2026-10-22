const LONDON_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Exhibition dates are calendar days at the London gallery, so "today" for the current, upcoming
 * and past filters is the London date (YYYY-MM-DD), not the UTC one. Using UTC would move shows
 * between tabs an hour late every night during BST and disagree with lax.art's own closed state.
 */
export function londonIsoDate(now: Date): string {
  return LONDON_DATE.format(now);
}
