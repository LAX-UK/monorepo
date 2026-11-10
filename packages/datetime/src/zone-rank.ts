import { cityName } from "./city.js";
import type { ZoneChoice } from "./zone-choices.js";

/** The zones LAX sells in most, shown first before anything is typed and ahead of equal matches. */
export const PINNED_ZONES: readonly string[] = [
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "America/Los_Angeles",
  "Australia/Sydney",
];

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s/_()+-]+/)
    .filter(Boolean);
}

/** 0 a city-name prefix, 1 a word prefix anywhere, 2 contained anywhere, null no match. */
function matchRank(choice: ZoneChoice, query: string): 0 | 1 | 2 | null {
  if (cityName(choice.zone).toLowerCase().startsWith(query)) return 0;
  const haystack = `${choice.label} ${choice.zone}`.toLowerCase();
  if (words(haystack).some((word) => word.startsWith(query))) return 1;
  return haystack.includes(query) ? 2 : null;
}

function pinnedIndex(choice: ZoneChoice): number {
  const index = PINNED_ZONES.indexOf(choice.zone);
  return index === -1 ? PINNED_ZONES.length : index;
}

/**
 * The choices that match what was typed, best first: a city-name prefix, then a word prefix, then
 * anything containing it; equal matches list the pinned zones first. With nothing typed, the
 * pinned zones lead and the rest follow alphabetically.
 */
export function rankZoneChoices(choices: readonly ZoneChoice[], query: string): ZoneChoice[] {
  const text = query.trim().toLowerCase();
  return choices
    .flatMap((choice) => {
      const rank = text === "" ? 0 : matchRank(choice, text);
      return rank === null ? [] : [{ choice, rank }];
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        pinnedIndex(a.choice) - pinnedIndex(b.choice) ||
        a.choice.label.localeCompare(b.choice.label, "en-GB"),
    )
    .map(({ choice }) => choice);
}
