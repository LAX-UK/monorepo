import type { Lot } from "@auction/types";
import { STANDARD_BUYER_PREMIUM_BANDS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { buildSalePremiumOverview, differingLotsTitle } from "./sale-premium-overview";

type OverviewLot = Pick<
  Lot,
  "id" | "lotNumber" | "title" | "status" | "winnerId" | "buyerPremiumRate"
>;
const lot = (over: Partial<OverviewLot>): OverviewLot => ({
  id: "lot",
  lotNumber: 1,
  title: "Still life",
  status: "draft",
  winnerId: null,
  buyerPremiumRate: null,
  ...over,
});
const standardSale = {
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
};

describe("buildSalePremiumOverview (staff sale overview)", () => {
  it("says the sale's premium in words with a worked example", () => {
    const vm = buildSalePremiumOverview(standardSale, []);
    expect(vm).toMatchObject({
      terms: "15% up to £500,000, then 10% on the part above",
      example: "On a £600,000 hammer the buyer pays £85,000 premium",
      isStandard: true,
      differingLots: [],
      editableLotIds: [],
    });
  });

  it("marks a sale on its own premium", () => {
    const vm = buildSalePremiumOverview({ buyerPremiumRate: "0.25", buyerPremiumTiers: null }, []);
    expect(vm.isStandard).toBe(false);
    expect(vm.terms).toBe("25% on the hammer");
  });

  it("lists unsold lots whose own premium differs, and offers only those not yet open", () => {
    const vm = buildSalePremiumOverview(standardSale, [
      lot({ id: "a", lotNumber: 3, title: "Lemons", buyerPremiumRate: "0.2500" }),
      lot({ id: "b", lotNumber: 4, status: "active", buyerPremiumRate: "0.2500" }),
      lot({ id: "c", status: "ended", winnerId: "u1", buyerPremiumRate: "0.2500" }),
      lot({ id: "d", buyerPremiumRate: null }),
      lot({
        id: "e",
        status: "scheduled",
        lotNumber: null,
        title: "Pears",
        buyerPremiumRate: "0.2",
      }),
    ]);
    expect(vm.differingLots).toEqual([
      { id: "a", label: "Lot 3 · Lemons", premium: "25% on the hammer", editable: true },
      { id: "b", label: "Lot 4 · Still life", premium: "25% on the hammer", editable: false },
      { id: "e", label: "Pears", premium: "20% on the hammer", editable: true },
    ]);
    expect(vm.editableLotIds).toEqual(["a", "e"]);
  });

  it("does not list a lot whose own rate is the sale's flat rate", () => {
    const vm = buildSalePremiumOverview({ buyerPremiumRate: "0.2500", buyerPremiumTiers: null }, [
      lot({ buyerPremiumRate: "0.25" }),
    ]);
    expect(vm.differingLots).toEqual([]);
  });

  it("titles the warning for one lot and for several", () => {
    expect(differingLotsTitle(1)).toBe("1 unsold lot charges a different premium from the sale");
    expect(differingLotsTitle(3)).toBe("3 unsold lots charge a different premium from the sale");
  });
});
