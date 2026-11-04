import { describe, expect, it } from "vitest";
import { projectDealForParty, projectDealForStaff } from "./anonymity.js";
import { BUYER, NOW, SELLER, acceptedTerms, deal } from "./deal-fixtures.test-util.js";

const agreed = (over = {}) =>
  deal({
    stage: "agreed",
    buyer: BUYER,
    priceMinor: 4_800_000,
    buyerFeeBps: 500,
    sellerCommissionBps: 1500,
    costsMinor: 35_000,
    agreedAt: NOW,
    ...over,
  });

describe("what each side may see", () => {
  it("shows the other side as LAX by default", () => {
    const seller = projectDealForParty(agreed(), "seller");
    const buyer = projectDealForParty(agreed(), "buyer");
    expect(seller?.counterparty).toEqual({ disclosed: false, label: "LAX" });
    expect(buyer?.counterparty).toEqual({ disclosed: false, label: "LAX" });
  });

  it("names the other side only when the deal discloses parties", () => {
    const seller = projectDealForParty(agreed({ partiesDisclosed: true }), "seller");
    const buyer = projectDealForParty(agreed({ partiesDisclosed: true }), "buyer");
    expect(seller?.counterparty).toEqual({ disclosed: true, label: BUYER.displayName });
    expect(buyer?.counterparty).toEqual({ disclosed: true, label: SELLER.displayName });
  });

  it("never carries the other side's identifiers, checks or acting user", () => {
    const view = JSON.stringify(projectDealForParty(agreed(), "seller"));
    for (const secret of [BUYER.legalEntityId, BUYER.displayName, BUYER.actingUserId, "u-owner"]) {
      expect(view).not.toContain(String(secret));
    }
    const buyerView = JSON.stringify(projectDealForParty(agreed(), "buyer"));
    for (const secret of [SELLER.legalEntityId, SELLER.displayName, SELLER.actingUserId]) {
      expect(buyerView).not.toContain(String(secret));
    }
  });

  it("shows each side its own money lines only", () => {
    const seller = projectDealForParty(agreed(), "seller");
    const buyer = projectDealForParty(agreed(), "buyer");
    expect(seller?.sellerMoney).toEqual({
      priceMinor: 4_800_000,
      sellerCommissionMinor: 720_000,
      costsMinor: 35_000,
      netToSellerMinor: 4_045_000,
    });
    expect(seller?.buyerMoney).toBeNull();
    expect(buyer?.buyerMoney).toEqual({
      priceMinor: 4_800_000,
      buyerFeeMinor: 240_000,
      totalDueMinor: 5_040_000,
    });
    expect(buyer?.sellerMoney).toBeNull();
    expect(JSON.stringify(buyer)).not.toContain("720000");
    expect(JSON.stringify(seller)).not.toContain("240000");
  });

  it("keeps the price under discussion until it is agreed", () => {
    for (const stage of ["proposed", "offer"] as const) {
      for (const role of ["seller", "buyer"] as const) {
        const view = projectDealForParty(
          deal({ stage, buyer: BUYER, priceMinor: 4_800_000 }),
          role,
        );
        expect(view?.priceState).toBe("under_discussion");
        expect(view?.buyerMoney).toBeNull();
        expect(view?.sellerMoney).toBeNull();
      }
    }
    expect(projectDealForParty(agreed(), "buyer")?.priceState).toBe("agreed");
  });

  it("gives the buyer the payment date and not the seller", () => {
    const due = new Date("2026-11-10T10:00:00Z");
    const over = { stage: "invoiced" as const, paymentDueAt: due };
    expect(projectDealForParty(agreed(over), "buyer")?.paymentDueAt).toEqual(due);
    expect(projectDealForParty(agreed(over), "seller")?.paymentDueAt).toBeNull();
  });

  it("has no view for a side that is not named yet", () => {
    expect(projectDealForParty(deal(), "buyer")).toBeNull();
    expect(projectDealForParty(deal(), "seller")).not.toBeNull();
  });

  it("shows a party only the documents meant for it", () => {
    const base = acceptedTerms(SELLER);
    const doc = (
      id: string,
      audience: "staff" | "seller" | "buyer" | "both",
      entity: string | null,
    ) => ({
      ...base,
      id,
      kind: "other" as const,
      audience,
      legalEntityId: entity,
      acceptedAt: null,
      acceptedByUserId: null,
    });
    const documents = [
      doc("staff-note", "staff", null),
      doc("seller-only", "seller", SELLER.legalEntityId),
      doc("buyer-only", "buyer", BUYER.legalEntityId),
      doc("shared", "both", null),
      doc("buyer-terms", "both", BUYER.legalEntityId),
    ];
    const ids = (role: "seller" | "buyer") =>
      projectDealForParty(agreed({ documents }), role)?.documents.map((d) => d.id);
    expect(ids("seller")).toEqual(["seller-only", "shared"]);
    expect(ids("buyer")).toEqual(["buyer-only", "shared", "buyer-terms"]);
  });

  it("exposes only the fields it lists", () => {
    const view = projectDealForParty(agreed(), "seller");
    expect(Object.keys(view ?? {}).sort()).toEqual(
      [
        "audience",
        "buyerMoney",
        "collectionDueAt",
        "counterparty",
        "documents",
        "itemSubmissionId",
        "paymentDueAt",
        "priceState",
        "reference",
        "sellerMoney",
        "stage",
        "you",
      ].sort(),
    );
  });

  it("gives staff the whole deal", () => {
    const view = projectDealForStaff(agreed());
    expect(view.audience).toBe("staff");
    expect(view.deal.buyer?.legalEntityId).toBe(BUYER.legalEntityId);
    expect(view.money?.netToSellerMinor).toBe(4_045_000);
    expect(projectDealForStaff(deal()).money).toBeNull();
  });
});
