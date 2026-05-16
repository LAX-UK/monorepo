import { mapSaleToCalendarGridCardVM } from "@/components/sections/sales/sales-view-models";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const start = new Date("2026-04-09T10:00:00Z");
  const end = new Date("2026-04-16T18:00:00Z");
  return {
    id: "s1",
    title: "Spring Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    streamUrl: null,
    locationName: "London",
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "scheduled",
    startTime: start,
    endTime: end,
    previewStartTime: null,
    buyerPremiumRate: "0",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: start,
    updatedAt: start,
    ...overrides,
  };
}

describe("mapSaleToCalendarGridCardVM", () => {
  it("extends featured VM with itemsLabel, lotsHref, and register flag", () => {
    const sale = makeSale();
    const lots: Lot[] = [{ id: "l1" } as Lot, { id: "l2" } as Lot];
    const vm = mapSaleToCalendarGridCardVM(sale, lots, { showRegisterButton: true });
    expect(vm.itemsLabel).toBe("2 Items");
    expect(vm.lotsHref).toMatch(/spring-sale/i);
    expect(vm.showRegisterButton).toBe(true);
    expect(vm.auctionTypeLabel).toBe("Online Auction");
    expect(vm.title).toBe("Spring Sale");
  });

  it("omits countdown when sale is not active", () => {
    const sale = makeSale({ status: "scheduled" });
    const vm = mapSaleToCalendarGridCardVM(sale, [], { showRegisterButton: false });
    expect(vm.countdownEndIso).toBeUndefined();
  });
});
