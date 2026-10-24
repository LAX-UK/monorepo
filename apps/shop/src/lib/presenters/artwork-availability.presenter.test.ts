import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { presentArtworkAvailability } from "./artwork-availability.presenter.js";

const artwork = (overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail => ({
  slug: "warm-basket",
  title: "Warm Basket",
  artistName: "Flora Powers",
  artistSlug: "flora-powers",
  description: null,
  imageUrl: null,
  saleState: "for_sale",
  dimensions: null,
  yearCreated: null,
  medium: null,
  salesChannel: "shop",
  eligibleForEditionAllocation: true,
  printPricePence: 12000,
  availability: { totalEditions: 24, state: "available" },
  ...overrides,
});

describe("presentArtworkAvailability", () => {
  it("presents an available edition with its size and allocation guidance", () => {
    expect(presentArtworkAvailability(artwork())).toEqual({
      status: { label: "Available", tone: "success" },
      headline: "Limited edition of 24",
      detail: "Edition numbers are assigned when your order is fulfilled.",
    });
  });

  it("shows a sold-out edition with a next step", () => {
    expect(
      presentArtworkAvailability(
        artwork({ availability: { totalEditions: 24, state: "sold_out" } }),
      ),
    ).toEqual({
      status: { label: "Sold out", tone: "neutral" },
      headline: "Limited edition of 24",
      detail: null,
    });
  });

  it("never shows a remaining count, a low-stock warning or a meter", () => {
    const view = presentArtworkAvailability(artwork());
    expect(view).not.toHaveProperty("meter");
    expect(JSON.stringify(view)).not.toMatch(/\d+ of \d+|only a few|claimed|remain/i);
  });

  it("reports sold works as unavailable regardless of edition data", () => {
    expect(
      presentArtworkAvailability(
        artwork({
          saleState: "sold",
          availability: { totalEditions: 0, state: "sold_out" },
        }),
      ),
    ).toEqual({
      status: { label: "Sold out", tone: "neutral" },
      headline: "This work is no longer available",
      detail: null,
    });
  });
});
