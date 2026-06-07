import type { AmlWatchlistCategory } from "./aml-types.js";
export { mapProviderListToCategory } from "../../lib/veriff/veriff-watchlist-categories.js";

/**
 * Watchlist categories the platform must screen against to satisfy London
 * Auction Xchange CDD Section 5 (sanctions, PEPs, adverse media, plus regulator
 * warning and fitness-and-probity lists). The Veriff "PEP & Sanctions" add-on
 * must be configured in the Veriff portal to return these datasets; see
 * docs/runbooks/aml-workflow.md for the portal configuration checklist.
 */
export const REQUIRED_WATCHLIST_CATEGORIES: readonly AmlWatchlistCategory[] = [
  "sanction",
  "pep",
  "adverse_media",
  "warning",
  "fitness_probity",
] as const;
