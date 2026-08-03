import {
  mapSaleToAgendaItemVM,
  mapSaleToAuctionRowVM,
  mapSaleToCalendarGridCardVM,
  mapSaleToFeaturedAuctionCardVM,
} from "@/components/sections/sales/sales-view-models";
import { saleListRow } from "@/lib/sale-list-row";
import type { Lot, Sale } from "@auction/types";
import { toSaleCountdownEndIso } from "@auction/validators";
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
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
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
    const vm = mapSaleToCalendarGridCardVM(saleListRow(sale, lots), { showRegisterButton: true });
    expect(vm.itemsLabel).toBe("2 Items");
    expect(vm.lotsHref).toMatch(/spring-sale/i);
    expect(vm.showRegisterButton).toBe(true);
    expect(vm.auctionTypeLabel).toBe("Online Auction");
    expect(vm.title).toBe("Spring Sale");
  });

  it("omits countdown when sale is not active", () => {
    const sale = makeSale({ status: "scheduled" });
    const vm = mapSaleToCalendarGridCardVM(saleListRow(sale, []), { showRegisterButton: false });
    expect(vm.countdownEndIso).toBeUndefined();
  });

  it("uses lotCount from row instead of preview lots.length", () => {
    const sale = makeSale();
    const previewLots: Lot[] = [
      { id: "l1" } as Lot,
      { id: "l2" } as Lot,
      { id: "l3" } as Lot,
      { id: "l4" } as Lot,
    ];
    const vm = mapSaleToCalendarGridCardVM(saleListRow(sale, previewLots, 15), {
      showRegisterButton: false,
    });
    expect(vm.itemsLabel).toBe("15 Items");
  });
});

describe("mapSaleToAuctionRowVM", () => {
  it("uses lotCount from row instead of preview lots.length", () => {
    const sale = makeSale();
    const previewLots: Lot[] = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}` }) as Lot);
    const vm = mapSaleToAuctionRowVM(saleListRow(sale, previewLots, 20), {
      showRegisterButton: false,
    });
    expect(vm.itemsLabel).toBe("20 Items");
  });

  it("falls back to lots.length when lotCount matches preview length", () => {
    const sale = makeSale();
    const lots: Lot[] = [{ id: "l1" } as Lot];
    const vm = mapSaleToAuctionRowVM(saleListRow(sale, lots), { showRegisterButton: false });
    expect(vm.itemsLabel).toBe("1 Item");
  });
});

describe("mapSaleToAgendaItemVM", () => {
  it("uses row lotCount instead of preview lots.length", () => {
    const sale = makeSale();
    const previewLots: Lot[] = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}` }) as Lot);
    const vm = mapSaleToAgendaItemVM(saleListRow(sale, previewLots, 10));
    expect(vm.itemsLabel).toBe("10 lots");
  });
});

describe("mapSaleToFeaturedAuctionCardVM", () => {
  it("includes itemsLabel derived from lotCount", () => {
    const sale = makeSale();
    const previewLots: Lot[] = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}` }) as Lot);
    const vm = mapSaleToFeaturedAuctionCardVM(saleListRow(sale, previewLots, 8));
    expect(vm.itemsLabel).toBe("8 Items");
  });

  it("falls back to lots.length when lotCount omitted", () => {
    const sale = makeSale();
    const lots: Lot[] = [{ id: "l1" } as Lot, { id: "l2" } as Lot];
    const vm = mapSaleToFeaturedAuctionCardVM(saleListRow(sale, lots));
    expect(vm.itemsLabel).toBe("2 Items");
  });
});

describe("saleroom past-end countdown suppression", () => {
  it("omits countdown for active hybrid sales past scheduled end", () => {
    const sale = makeSale({
      status: "active",
      deliveryMode: "hybrid",
      endTime: new Date("2026-04-01T10:00:00Z"),
    });
    const now = new Date("2026-04-09T10:00:00Z");
    const vm = mapSaleToCalendarGridCardVM(saleListRow(sale, []), { showRegisterButton: false });
    expect(
      toSaleCountdownEndIso(
        { status: sale.status, endTime: sale.endTime, deliveryMode: sale.deliveryMode },
        { now },
      ),
    ).toBeUndefined();
    expect(vm.countdownEndIso).toBeUndefined();
  });

  it("keeps countdown for active online sales past scheduled end", () => {
    const sale = makeSale({
      status: "active",
      deliveryMode: "online",
      endTime: new Date("2026-04-01T10:00:00Z"),
    });
    const now = new Date("2026-04-09T10:00:00Z");
    expect(
      toSaleCountdownEndIso(
        { status: sale.status, endTime: sale.endTime, deliveryMode: sale.deliveryMode },
        { now },
      ),
    ).toBe("2026-04-01T10:00:00.000Z");
  });
});
