import type { AmlWatchlistCategory } from "../../services/aml/aml-types.js";

/**
 * Maps a Veriff list/dataset label onto the platform's canonical watchlist category.
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
  ) {
    return "pep";
  }
  if (normalized.includes("adverse") || normalized.includes("media")) return "adverse_media";
  if (normalized.includes("warning")) return "warning";
  if (normalized.includes("fitness") || normalized.includes("probity")) return "fitness_probity";
  return "other";
}
