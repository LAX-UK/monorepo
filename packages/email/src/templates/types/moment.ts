/**
 * A time as an email shows it: the official value (with its zone name; the sale's own clock), and
 * under it the recipient's local time as plain text when they have a saved zone that differs.
 */
export type EmailMoment = {
  /** "Thu 12 Nov, 18:00 GMT". */
  official: string;
  /** "Fri 13 Nov, 05:00 in Sydney": left out when it would add nothing. */
  local?: string | null;
};

/**
 * Says where the local times come from, so the person can change them. Present only when the
 * email shows a local time: with none there is nothing to explain.
 */
export type ZoneNote = {
  /** The saved zone's city: "Sydney". */
  city: string;
  /** LAX Account › Personal details › Time zone. */
  changeUrl: string;
};
