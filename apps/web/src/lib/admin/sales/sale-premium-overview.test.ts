import type { Lot } from "@auction/types";
import { STANDARD_BUYER_PREMIUM_BANDS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  buildSalePremiumOverview,
  differingLotsTitle,
  lotChargesOwnPremium,
  moreLotsLabel,
  openLotsNote,
  salePremiumActionLabel,
} from "./sale-premium-overview";

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
  id: "sale-1",
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
};

describe("buildSalePremiumOverview (staff sale overview)", () => {
  it("says the sale's premium in words with a worked example", () => {
    const vm = buildSalePremiumOverview(standardSale, []);
    expect(vm).toMatchObject({
      terms: "15% up to £500,000, then 10% on the part above",
      example: "On a £600,000 hammer the buyer's premium is £85,000.",
      isStandard: true,
      differingLots: [],
      editableLotIds: [],
    });
  });

  it("marks a sale on its own premium", () => {
    const vm = buildSalePremiumOverview(
      { id: "sale-1", buyerPremiumRate: "0.25", buyerPremiumTiers: null },
      [],
    );
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
      {
        id: "a",
        label: "Lot 3 · Lemons",
        premium: "25% on the hammer",
        editable: true,
        href: "/admin/lots/a",
      },
      {
        id: "b",
        label: "Lot 4 · Still life",
        premium: "25% on the hammer",
        editable: false,
        href: "/admin/lots/b",
      },
      {
        id: "e",
        label: "Pears",
        premium: "20% on the hammer",
        editable: true,
        href: "/admin/lots/e",
      },
    ]);
    expect(vm.editableLotIds).toEqual(["a", "e"]);
    expect(vm.openCount).toBe(1);
    expect(vm.more).toBeNull();
  });

  it("does not list a lot whose own rate is the sale's flat rate", () => {
    const vm = buildSalePremiumOverview(
      { id: "s", buyerPremiumRate: "0.2500", buyerPremiumTiers: null },
      [lot({ buyerPremiumRate: "0.25" })],
    );
    expect(vm.differingLots).toEqual([]);
  });

  it("names the first 5 lots and links the rest to the lots tab filtered to their own premium", () => {
    const lots = Array.from({ length: 12 }, (_, i) =>
      lot({ id: `l${i + 1}`, lotNumber: i + 1, buyerPremiumRate: "0.2500" }),
    );
    const vm = buildSalePremiumOverview(standardSale, lots);
    expect(vm.differingLots).toHaveLength(12);
    expect(vm.shownLots.map((l) => l.id)).toEqual(["l1", "l2", "l3", "l4", "l5"]);
    expect(vm.more).toEqual({ count: 7, href: "/admin/sales/sale-1/lots?premium=own" });
    expect(moreLotsLabel(7)).toBe("and 7 more");
    expect(differingLotsTitle(vm.differingLots.length)).toBe(
      "12 unsold lots charge a different premium from the sale",
    );
  });

  it("names the count on the action and says which lots are open for bidding", () => {
    expect(salePremiumActionLabel(2)).toBe("Use the sale's premium for 2 lots");
    expect(salePremiumActionLabel(1)).toBe("Use the sale's premium for 1 lot");
    expect(openLotsNote(0)).toBeNull();
    expect(openLotsNote(1)).toBe("1 lot is open for bidding and keeps its premium.");
    expect(openLotsNote(3)).toBe("3 lots are open for bidding and keep their premium.");
  });

  it("finds the same lots for the lots tab's Own premium filter", () => {
    expect(lotChargesOwnPremium(lot({ buyerPremiumRate: "0.2500" }), standardSale)).toBe(true);
    expect(
      lotChargesOwnPremium(lot({ status: "active", buyerPremiumRate: "0.2500" }), standardSale),
    ).toBe(true);
    expect(lotChargesOwnPremium(lot({ buyerPremiumRate: null }), standardSale)).toBe(false);
    expect(
      lotChargesOwnPremium(
        lot({ status: "ended", winnerId: "u1", buyerPremiumRate: "0.2500" }),
        standardSale,
      ),
    ).toBe(false);
  });

  it("titles the warning for one lot and for several", () => {
    expect(differingLotsTitle(1)).toBe("1 unsold lot charges a different premium from the sale");
    expect(differingLotsTitle(3)).toBe("3 unsold lots charge a different premium from the sale");
  });
});
