import { describe, expect, it } from "vitest";
import { OFFER_STATES } from "./offer-state.js";
import { WHERE_IT_IS_KEYS, WITHDRAWN_DISPLAY_DAYS } from "./where-it-is.js";
import { zohoStatusByOfferState, zohoStatusFor, zohoStatusForPlace } from "./zoho-status.js";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe("zohoStatusForPlace", () => {
  it.each([
    ["not_offered", "Available"],
    ["draft_lax_art", "Available"],
    ["lax_art", "Available"],
    ["draft_bid_lot", "Available"],
    ["bid_sale", "In Auction"],
    ["private_sale", "Reserved"],
    ["withdrawn", "Withdrawn"],
    ["sold", "Sold"],
  ] as const)("maps %s to %s", (place, status) => {
    expect(zohoStatusForPlace(place)).toBe(status);
  });

  it("covers every place", () => {
    for (const place of WHERE_IT_IS_KEYS) expect(zohoStatusForPlace(place)).toBeTruthy();
  });
});

describe("zohoStatusFor", () => {
  const withdrawn = (days: number) => ({
    offer: { state: "withdrawn" as const, ref: null },
    now: NOW,
    withdrawn: { at: daysAgo(days), from: null },
  });

  it("reads Withdrawn for the days the place shows it, then Available", () => {
    expect(zohoStatusFor(withdrawn(5))).toBe("Withdrawn");
    expect(zohoStatusFor(withdrawn(WITHDRAWN_DISPLAY_DAYS + 1))).toBe("Available");
  });

  it("keeps Withdrawn when the history does not say when", () => {
    expect(zohoStatusFor({ offer: { state: "withdrawn", ref: null }, now: NOW })).toBe("Withdrawn");
  });
});

describe("zohoStatusByOfferState", () => {
  it("agrees with zohoStatusFor for every state, inside and past the Withdrawn window", () => {
    for (const shows of [true, false]) {
      const table = zohoStatusByOfferState(shows);
      for (const state of OFFER_STATES) {
        const expected = zohoStatusFor({
          offer: { state, ref: null },
          now: NOW,
          withdrawn: { at: daysAgo(shows ? 5 : 31), from: null },
        });
        expect(table[state]).toBe(expected);
      }
    }
  });

  it("is where only Withdrawn changes", () => {
    const shown = zohoStatusByOfferState(true);
    const expired = zohoStatusByOfferState(false);
    const changed = OFFER_STATES.filter((state) => shown[state] !== expired[state]);
    expect(changed).toEqual(["withdrawn"]);
  });
});
