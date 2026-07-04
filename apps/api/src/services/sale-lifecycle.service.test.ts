import type { ILotRepository, ISaleRepository } from "@auction/persistence";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { SaleLifecycleService } from "./sale-lifecycle.service.js";

function sale(overrides: Partial<Sale> = {}): Sale {
  const now = new Date();
  return {
    id: "s1",
    title: "Test sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "scheduled",
    startTime: now,
    endTime: now,
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdBy: "admin",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function childLot(status: Lot["status"], id = "l1"): Lot {
  const now = new Date();
  return {
    id,
    saleId: "s1",
    lotNumber: 1,
    sellerId: "seller",
    title: "Child",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1000001-0000-4000-8000-000000000001",
    auctionType: "english",
    startingPrice: "10",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "10",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: now,
    status,
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
  };
}

describe("SaleLifecycleService", () => {
  it("marks sale ended when all child lots are terminal", async () => {
    const sales: ISaleRepository = {
      findWithStatuses: vi.fn().mockResolvedValue([sale({ status: "scheduled" })]),
      updateStatus: vi.fn(),
    } as unknown as ISaleRepository;

    const lots: ILotRepository = {
      findBySaleIds: vi
        .fn()
        .mockResolvedValue([childLot("ended", "l1"), childLot("cancelled", "l2")]),
    } as unknown as ILotRepository;

    const svc = new SaleLifecycleService(sales, lots);
    await svc.reconcileSaleStatuses();

    expect(sales.updateStatus).toHaveBeenCalledWith("s1", "ended");
  });

  it("activates scheduled sale when any child is active", async () => {
    const sales: ISaleRepository = {
      findWithStatuses: vi.fn().mockResolvedValue([sale({ status: "scheduled" })]),
      updateStatus: vi.fn(),
    } as unknown as ISaleRepository;

    const lots: ILotRepository = {
      findBySaleIds: vi
        .fn()
        .mockResolvedValue([childLot("active", "l1"), childLot("scheduled", "l2")]),
    } as unknown as ILotRepository;

    const svc = new SaleLifecycleService(sales, lots);
    await svc.reconcileSaleStatuses();

    expect(sales.updateStatus).toHaveBeenCalledWith("s1", "active");
  });
});
