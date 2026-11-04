import type { MatchSnapshot } from "@auction/alerts";
import type { ArtistAlertCriteria } from "@auction/domain";
import type { AlertableLot } from "@auction/persistence/interfaces";
import { lotPath } from "@auction/types";

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
  group?: { label: string; criteria?: string },
): MatchSnapshot {
  const subtitle = [lot.medium, lot.saleTitle].filter((part): part is string => Boolean(part));
  return {
    title: lot.title,
    ...(subtitle.length > 0 ? { subtitle: subtitle.join(" · ") } : {}),
    detail: lotPriceLine(lot),
    path: lotPath(lot),
    ...(group ? { groupLabel: group.label } : {}),
    ...(group?.criteria ? { groupCriteria: group.criteria } : {}),
  };
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
