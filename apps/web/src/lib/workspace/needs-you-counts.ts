/**
 * The sidebar's counts come from the one Needs-you reader (`GET /legal-entities/needs-you`), the
 * same table Home's "Needs you" reads, so a count always matches the tasks behind it.
 */
export const NEEDS_YOU_SECTIONS = [
  "bids",
  "purchases",
  "consignments",
  "team",
  "organisation",
] as const;
export type NeedsYouSection = (typeof NEEDS_YOU_SECTIONS)[number];
export type NeedsYouCounts = Readonly<Partial<Record<NeedsYouSection, number>>>;

/** The menu entry each section's count belongs to (ids from the client nav model). */
const NAV_ID: Record<NeedsYouSection, string> = {
  bids: "bids",
  purchases: "purchases",
  consignments: "consignments",
  team: "team",
  organisation: "organisation",
};

/**
 * Counts by menu entry id, keeping only the ones above zero: a lone 0 beside an entry says
 * nothing and reads as an error.
 */
export function navCountsFrom(counts: NeedsYouCounts | null): Readonly<Record<string, number>> {
  if (!counts) return {};
  const out: Record<string, number> = {};
  for (const section of NEEDS_YOU_SECTIONS) {
    const value = counts[section];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[NAV_ID[section]] = Math.floor(value);
    }
  }
  return out;
}
