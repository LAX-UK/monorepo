import type { AmlWatchlistCategory } from "./aml-types.js";

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

/**
 * Maps a provider list/dataset label onto the platform's canonical category.
 * Unknown labels fall back to `other` so they are never silently dropped.
 */
export function mapProviderListToCategory(raw: string | null | undefined): AmlWatchlistCategory {
  if (!raw) return "other";
  const normalized = raw
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "_");
  if (normalized.includes("sanction")) return "sanction";
  if (
    normalized === "pep" ||
    normalized.includes("politically_exposed") ||
    normalized.includes("pep")
  )
    return "pep";
  if (normalized.includes("adverse") || normalized.includes("media")) return "adverse_media";
  if (normalized.includes("warning")) return "warning";
  if (normalized.includes("fitness") || normalized.includes("probity")) return "fitness_probity";
  return "other";
}
