import type { MatchSnapshot } from "@auction/alerts";
import type { ArtistAlertCriteria } from "@auction/domain";
import type { AlertableLot } from "@auction/persistence/interfaces";
import { artistPath, lotPath } from "@auction/types";

function money(amount: string, currency = "GBP"): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** "Estimate £2,000 to £3,000", or the start price when the lot has no estimate. */
export function lotPriceLine(lot: AlertableLot): string {
  if (lot.estimate) {
    const { low, high, currency } = lot.estimate;
    return `Estimate ${money(low, currency)} to ${money(high, currency)}`;
  }
  return `Starting at ${money(lot.startingPrice)}`;
}

/** What an email shows about a lot, whichever alert it matched. */
export function lotSnapshot(
  lot: AlertableLot,
  group?: { label: string; criteria?: string; path?: string },
): MatchSnapshot {
  const subtitle = [lot.medium, lot.saleTitle].filter((part): part is string => Boolean(part));
  return {
    title: lot.title,
    ...(subtitle.length > 0 ? { subtitle: subtitle.join(" · ") } : {}),
    detail: lotPriceLine(lot),
    path: lotPath(lot),
    ...(group ? { groupLabel: group.label } : {}),
    ...(group?.path ? { groupPath: group.path } : {}),
    ...(group?.criteria ? { groupCriteria: group.criteria } : {}),
  };
}

/** The artist's page on the site. */
export function artistPagePath(artistId: string, artistName: string | null): string {
  return artistPath({ id: artistId, name: artistName ?? "artist" });
}

/** The search results page for a saved search, as the search page reads its parameters. */
export function searchResultsPath(query: { q: string; categoryId: string | null }): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.categoryId) params.set("categoryId", query.categoryId);
  const text = params.toString();
  return text ? `/search?${text}` : "/search";
}

/** The person's criteria in words, shown under the artist: "Oil · £2,000 to £20,000". */
export function artistCriteriaLine(criteria: ArtistAlertCriteria): string {
  const parts: string[] = [];
  if (criteria.medium?.trim()) parts.push(criteria.medium.trim());
  const { priceMin, priceMax } = criteria;
  if (priceMin && priceMax) parts.push(`${money(priceMin)} to ${money(priceMax)}`);
  else if (priceMin) parts.push(`from ${money(priceMin)}`);
  else if (priceMax) parts.push(`up to ${money(priceMax)}`);
  return parts.length > 0 ? parts.join(" · ") : "Every new lot";
}
