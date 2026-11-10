import type { Lot, PublicLotView, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { SaleLookupPort } from "../container/container-slices.js";
import {
  lotsWithCheckoutPricing,
  lotsWithSaleTimeZone,
  withSaleTimeZone,
} from "./lots-with-checkout-pricing.js";
import { mapLotToStaffListRow, mapLotToSummary } from "./mappers.js";

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Vase",
    status: "scheduled",
    auctionType: "english",
    currentPrice: "100.00",
    startingPrice: "100.00",
    buyerPremiumRate: "0.25",
    medium: null,
    startTime: new Date("2026-12-01T10:00:00Z"),
    endTime: new Date("2026-12-08T10:00:00Z"),
    images: [],
    categoryId: "c1",
    marketingDetails: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lot;
}

function salesPort(sales: Pick<Sale, "id" | "timeZone" | "buyerPremiumTiers">[]): {
  saleService: SaleLookupPort;
  findByIds: ReturnType<typeof vi.fn>;
} {
  const findByIds = vi.fn(async (ids: string[]) => sales.filter((s) => ids.includes(s.id)));
  return { saleService: { findByIds } as unknown as SaleLookupPort, findByIds };
}

const parisSale = { id: "sale-1", timeZone: "Europe/Paris", buyerPremiumTiers: null };

describe("lot payloads name their sale's time zone", () => {
  it("adds the zone to a lot that belongs to a sale", () => {
    expect(withSaleTimeZone(lot(), parisSale).timeZone).toBe("Europe/Paris");
  });

  it("leaves a lot with no sale without a zone", () => {
    expect(withSaleTimeZone(lot({ saleId: null }), null)).not.toHaveProperty("timeZone");
  });

  it("carries the zone on the summary and the staff list row", () => {
    const zoned = withSaleTimeZone(lot(), parisSale);
    expect(mapLotToSummary(zoned).timeZone).toBe("Europe/Paris");
    expect(mapLotToStaffListRow(zoned).timeZone).toBe("Europe/Paris");
    expect(mapLotToSummary(lot())).not.toHaveProperty("timeZone");
  });

  it("attaches each lot's own sale zone with one batched lookup", async () => {
    const { saleService, findByIds } = salesPort([
      parisSale,
      { id: "sale-2", timeZone: "America/New_York", buyerPremiumTiers: null },
    ]);
    const lots: (Lot | PublicLotView)[] = [
      lot({ id: "a", saleId: "sale-1" }),
      lot({ id: "b", saleId: "sale-2" }),
      lot({ id: "c", saleId: "sale-1" }),
      lot({ id: "d", saleId: null }),
    ];
    const result = await lotsWithSaleTimeZone({ saleService }, lots);
    expect(result.map((l) => l.timeZone)).toEqual([
      "Europe/Paris",
      "America/New_York",
      "Europe/Paris",
      undefined,
    ]);
    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(findByIds).toHaveBeenCalledWith(["sale-1", "sale-2"]);
  });

  it("adds the zone beside the checkout pricing", async () => {
    const { saleService } = salesPort([parisSale]);
    const [priced] = await lotsWithCheckoutPricing({ saleService }, [lot()]);
    expect(priced?.timeZone).toBe("Europe/Paris");
    expect(priced?.checkoutPricing).toBeDefined();
  });
});
