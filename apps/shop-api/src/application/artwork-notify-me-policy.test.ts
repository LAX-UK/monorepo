import { describe, expect, it } from "vitest";
import { isArtworkEligibleForNotifyMeSubscription } from "./artwork-notify-me-policy.js";

describe("isArtworkEligibleForNotifyMeSubscription", () => {
  it("rejects ineligible originals", () => {
    expect(
      isArtworkEligibleForNotifyMeSubscription({
        eligibleForEditionAllocation: false,
        printPricePence: null,
        editionsAvailable: 0,
        saleState: "for_sale",
      }),
    ).toBe(false);
  });

  it("rejects sold works", () => {
    expect(
      isArtworkEligibleForNotifyMeSubscription({
        eligibleForEditionAllocation: true,
        printPricePence: 12000,
        editionsAvailable: 0,
        saleState: "sold",
      }),
    ).toBe(false);
  });

  it("rejects purchasable online editions", () => {
    expect(
      isArtworkEligibleForNotifyMeSubscription({
        eligibleForEditionAllocation: true,
        printPricePence: 12000,
        editionsAvailable: 2,
        saleState: "for_sale",
      }),
    ).toBe(false);
  });

  it("accepts eligible but unavailable online", () => {
    expect(
      isArtworkEligibleForNotifyMeSubscription({
        eligibleForEditionAllocation: true,
        printPricePence: 12000,
        editionsAvailable: 0,
        saleState: "for_sale",
      }),
    ).toBe(true);
  });
});
