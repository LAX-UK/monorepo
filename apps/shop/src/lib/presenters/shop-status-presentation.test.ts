import { describe, expect, it } from "vitest";
import {
  resolveArtworkSaleStatePresentation,
  resolveCatalogueArtworkBadgePresentation,
  resolveEditionAvailabilityPresentation,
  resolveShopOrderStatusPresentation,
} from "./shop-status-presentation.js";

describe("shop status presentation", () => {
  it("maps artwork sale states to semantic tones", () => {
    expect(resolveArtworkSaleStatePresentation("for_sale")).toEqual({
      label: "For sale",
      tone: "success",
    });
    expect(resolveArtworkSaleStatePresentation("price_on_application")).toEqual({
      label: "Price on request",
      tone: "accent",
      hint: "Contact LAX and we will share the price for this work.",
    });
    expect(resolveCatalogueArtworkBadgePresentation("for_sale")).toBeNull();
    expect(resolveCatalogueArtworkBadgePresentation("sold")).toEqual({
      label: "Sold out",
      tone: "neutral",
    });
  });

  it("maps order statuses", () => {
    expect(resolveShopOrderStatusPresentation("pending_payment")).toMatchObject({
      tone: "pending",
      hint: "We are waiting for your payment to clear.",
    });
    expect(resolveShopOrderStatusPresentation("paid").tone).toBe("success");
    expect(resolveShopOrderStatusPresentation("cancelled").tone).toBe("critical");
    expect(resolveShopOrderStatusPresentation("payment_failed").tone).toBe("critical");
  });

  it("derives edition availability", () => {
    expect(
      resolveEditionAvailabilityPresentation({ editionsAvailable: 0, totalEditions: 10 }).tone,
    ).toBe("neutral");
    expect(
      resolveEditionAvailabilityPresentation({ editionsAvailable: 1, totalEditions: 10 }).tone,
    ).toBe("warning");
    expect(
      resolveEditionAvailabilityPresentation({ editionsAvailable: 5, totalEditions: 10 }).tone,
    ).toBe("success");
  });
});
