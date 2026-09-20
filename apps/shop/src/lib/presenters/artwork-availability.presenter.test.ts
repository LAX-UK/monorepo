import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { presentArtworkAvailability } from "./artwork-availability.presenter.js";

const artwork = (overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail => ({
  slug: "warm-basket",
  title: "Warm Basket",
  artistName: "Flora Powers",
  description: null,
  imageUrl: null,
  saleState: "for_sale",
  dimensions: null,
  yearCreated: null,
  eligibleForEditionAllocation: true,
  printPricePence: 12000,
  availability: { totalEditions: 24, editionsAvailable: 10 },
  ...overrides,
});

describe("presentArtworkAvailability", () => {
  it("presents available editions with allocation guidance", () => {
    expect(presentArtworkAvailability(artwork())).toEqual({
      status: { label: "Available", tone: "success" },
      headline: "10 of 24 editions available",
      detail: "Edition numbers are assigned when your order is fulfilled.",
      meter: { available: 10, total: 24 },
    });
  });

  it("uses limited language at the twenty-percent threshold", () => {
    expect(
      presentArtworkAvailability(
        artwork({ availability: { totalEditions: 10, editionsAvailable: 2 } }),
      ),
    ).toMatchObject({
      status: { label: "Limited", tone: "warning" },
      detail: "Only a few remain from this edition of 10.",
    });
  });

  it("turns zero remaining editions into a claimed state with a next step", () => {
    expect(
      presentArtworkAvailability(
        artwork({ availability: { totalEditions: 24, editionsAvailable: 0 } }),
      ),
    ).toEqual({
      status: { label: "Sold out", tone: "neutral" },
      headline: "All 24 editions are currently claimed",
      detail: "Join the list and we will email you if one is released.",
      meter: { available: 0, total: 24 },
    });
  });

  it("reports sold works as unavailable regardless of edition data", () => {
    expect(
      presentArtworkAvailability(
        artwork({
          saleState: "sold",
          eligibleForEditionAllocation: false,
          availability: { totalEditions: 0, editionsAvailable: 0 },
        }),
      ),
    ).toEqual({
      status: { label: "Sold out", tone: "neutral" },
      headline: "This work is no longer available",
      detail: null,
      meter: null,
    });
  });

  it("describes an original without edition programme language", () => {
    expect(
      presentArtworkAvailability(
        artwork({
          eligibleForEditionAllocation: false,
          availability: { totalEditions: 0, editionsAvailable: 0 },
        }),
      ),
    ).toEqual({
      status: { label: "Original", tone: "neutral" },
      headline: "Original work — one of one",
      detail: "A unique piece, not part of an edition series.",
      meter: null,
    });
  });
});
