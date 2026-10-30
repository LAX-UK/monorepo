import { describe, expect, it } from "vitest";
import {
  EMPTY_ARTIST_ALERT_CRITERIA,
  artistAlertCriteriaRefusal,
  lotMatchesArtistAlert,
} from "./artist-alert-criteria.js";

describe("artistAlertCriteriaRefusal", () => {
  it("accepts an empty or ordered range", () => {
    expect(artistAlertCriteriaRefusal(EMPTY_ARTIST_ALERT_CRITERIA)).toBeNull();
    expect(
      artistAlertCriteriaRefusal({ medium: null, priceMin: "500", priceMax: "500.00" }),
    ).toBeNull();
  });

  it("refuses a minimum above the maximum", () => {
    expect(artistAlertCriteriaRefusal({ medium: null, priceMin: "900", priceMax: "800" })).toBe(
      "alert_price_range_inverted",
    );
  });
});

describe("lotMatchesArtistAlert", () => {
  const lot = { medium: "Oil on canvas", price: "4000.00" };

  it("matches every lot when no criteria are set", () => {
    expect(lotMatchesArtistAlert(EMPTY_ARTIST_ALERT_CRITERIA, { medium: null, price: "1" })).toBe(
      true,
    );
  });

  it("matches the medium without regard to case", () => {
    const oil = { ...EMPTY_ARTIST_ALERT_CRITERIA, medium: " OIL " };
    expect(lotMatchesArtistAlert(oil, lot)).toBe(true);
    expect(lotMatchesArtistAlert({ ...EMPTY_ARTIST_ALERT_CRITERIA, medium: "print" }, lot)).toBe(
      false,
    );
    expect(lotMatchesArtistAlert(oil, { ...lot, medium: null })).toBe(false);
  });

  it("keeps the price inside the range, ends included", () => {
    const range = { medium: null, priceMin: "4000", priceMax: "6000" };
    expect(lotMatchesArtistAlert(range, lot)).toBe(true);
    expect(lotMatchesArtistAlert(range, { ...lot, price: "6000.00" })).toBe(true);
    expect(lotMatchesArtistAlert(range, { ...lot, price: "3999.99" })).toBe(false);
    expect(lotMatchesArtistAlert(range, { ...lot, price: "6000.01" })).toBe(false);
  });
});
