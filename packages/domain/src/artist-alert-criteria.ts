import { moneyGt, moneyLt } from "./money-compare.js";

/**
 * What a person wants to hear about for an artist they follow. Every field narrows the alert;
 * an empty criteria set means "every new lot by this artist".
 */
export type ArtistAlertCriteria = {
  /** Words the lot's medium must contain, for example "oil" or "screenprint". */
  medium: string | null;
  /** The lowest estimate or starting price worth hearing about, as a decimal string. */
  priceMin: string | null;
  /** The highest, as a decimal string. */
  priceMax: string | null;
};

export const EMPTY_ARTIST_ALERT_CRITERIA: ArtistAlertCriteria = {
  medium: null,
  priceMin: null,
  priceMax: null,
};

export type ArtistAlertCriteriaRefusal =
  /** The lowest price is above the highest. */
  "alert_price_range_inverted";

/** Whether the criteria make sense together; the shapes are checked where they arrive. */
export function artistAlertCriteriaRefusal(
  criteria: ArtistAlertCriteria,
): ArtistAlertCriteriaRefusal | null {
  if (criteria.priceMin && criteria.priceMax && moneyGt(criteria.priceMin, criteria.priceMax)) {
    return "alert_price_range_inverted";
  }
  return null;
}

/** A new lot, as far as an artist alert looks at it. */
export type ArtistAlertLot = {
  medium: string | null;
  /** The figure the price range is compared with: the low estimate, else the starting price. */
  price: string;
};

/** Whether a new lot by the followed artist matches the person's alert. */
export function lotMatchesArtistAlert(criteria: ArtistAlertCriteria, lot: ArtistAlertLot): boolean {
  if (criteria.medium) {
    const wanted = criteria.medium.trim().toLowerCase();
    if (wanted && !(lot.medium ?? "").toLowerCase().includes(wanted)) return false;
  }
  if (criteria.priceMin && moneyLt(lot.price, criteria.priceMin)) return false;
  if (criteria.priceMax && moneyGt(lot.price, criteria.priceMax)) return false;
  return true;
}
