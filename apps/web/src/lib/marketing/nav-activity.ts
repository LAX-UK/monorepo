import type { MegaMenuSection } from "@/components/layout/header-nav-config";

/** What the catalogue holds right now, as far as the navigation needs to know. */
export type NavActivity = {
  /** At least one sale is open for bidding. */
  liveSales: boolean;
  /** At least one lot closes within the next 24 hours. */
  endingSoon: boolean;
};

export type NavActivityKey = keyof NavActivity;

/** Nothing live: the safe reading when the catalogue cannot be reached. */
export const NO_NAV_ACTIVITY: NavActivity = { liveSales: false, endingSoon: false };

/**
 * Drops the menu items that point at a list with nothing in it, and removes the marker so the
 * rendered items are plain links. Sections and the other items are untouched.
 */
export function applyNavActivity(
  sections: readonly MegaMenuSection[],
  activity: NavActivity,
): MegaMenuSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => item.requires === undefined || activity[item.requires])
      .map(({ requires: _requires, ...item }) => item),
  }));
}
