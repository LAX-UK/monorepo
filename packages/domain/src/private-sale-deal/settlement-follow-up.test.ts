import { describe, expect, it } from "vitest";
import { settlementFollowUp } from "./settlement-follow-up.js";

const deal = { id: "deal-1", stage: "settled", artworkRegisterId: "art-1" } as const;
const register = (
  offerState: string,
  ref: { kind: string; id: string } | null = null,
  kind = "original",
) => ({
  kind,
  offerState,
  offerRefKind: ref?.kind ?? null,
  offerRefId: ref?.id ?? null,
});
const thisDeal = { kind: "private_sale", id: "deal-1" };

describe("settlementFollowUp", () => {
  it("is clear once the register shows the artwork sold through this deal", () => {
    expect(settlementFollowUp(deal, register("sold", thisDeal))).toBeNull();
  });

  it("is normal while the artwork is still held for this deal", () => {
    expect(settlementFollowUp(deal, register("private_sale", thisDeal))).toBe("normal");
  });

  it("is normal when the artwork is held or withdrawn, with nobody else's claim on it", () => {
    expect(settlementFollowUp(deal, register("held"))).toBe("normal");
    expect(settlementFollowUp(deal, register("withdrawn", thisDeal))).toBe("normal");
  });

  it("is urgent when the register shows the artwork in another place", () => {
    expect(settlementFollowUp(deal, register("lax_art", { kind: "shop_artwork", id: "s" }))).toBe(
      "urgent",
    );
    expect(settlementFollowUp(deal, register("bid_sale", { kind: "bid_lot", id: "l" }))).toBe(
      "urgent",
    );
    expect(
      settlementFollowUp(deal, register("private_sale", { kind: "private_sale", id: "deal-2" })),
    ).toBe("urgent");
  });

  it("is urgent when the artwork was sold some other way", () => {
    expect(settlementFollowUp(deal, register("sold", { kind: "gallery_sale", id: "z" }))).toBe(
      "urgent",
    );
    expect(settlementFollowUp(deal, register("sold", { kind: "private_sale", id: "deal-2" }))).toBe(
      "urgent",
    );
    expect(settlementFollowUp(deal, register("sold"))).toBe("urgent");
  });

  it("does not apply before settlement, without an artwork, or to prints", () => {
    expect(settlementFollowUp({ ...deal, stage: "paid" }, register("held"))).toBeNull();
    expect(settlementFollowUp({ ...deal, stage: "cancelled" }, register("held"))).toBeNull();
    expect(settlementFollowUp({ ...deal, artworkRegisterId: null }, null)).toBeNull();
    expect(settlementFollowUp(deal, register("held", null, "print"))).toBeNull();
    expect(settlementFollowUp(deal, null)).toBeNull();
  });
});
