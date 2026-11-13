import { standardBuyerPremiumBands } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  type PremiumCheckLot,
  legacyBuyerPremiumSchedule,
  lockedPremiumReason,
  premiumChangedAtDeploy,
} from "./buyer-premium-deploy-check.js";

const banded = { buyerPremiumRate: "0.2500", buyerPremiumTiers: standardBuyerPremiumBands() };
const flat = { buyerPremiumRate: "0.2000", buyerPremiumTiers: null };

const lot = (over: Partial<PremiumCheckLot>): PremiumCheckLot => ({
  status: "active",
  hasWinner: false,
  hasLiveInvoice: false,
  lotRate: "0.2500",
  ...over,
});
const live = lot({});
const soldNotInvoiced = lot({ status: "ended", hasWinner: true });

describe("legacyBuyerPremiumSchedule", () => {
  it("is the sale's bands whenever the sale has bands, whatever the lot holds", () => {
    expect(legacyBuyerPremiumSchedule("0.2500", banded)).toEqual({
      kind: "bands",
      bands: banded.buyerPremiumTiers,
    });
  });

  it("is the lot's own rate in a sale without bands, and outside a sale", () => {
    expect(legacyBuyerPremiumSchedule("0.2500", flat)).toEqual({ kind: "flat", rate: "0.2500" });
    expect(legacyBuyerPremiumSchedule("0.2500", null)).toEqual({ kind: "flat", rate: "0.2500" });
  });
});

describe("lockedPremiumReason", () => {
  it.each([
    [live, "live"],
    [soldNotInvoiced, "sold_not_invoiced"],
    [lot({ status: "ended", hasWinner: true, hasLiveInvoice: true }), null],
    [lot({ status: "ended" }), null],
    [lot({ status: "scheduled" }), null],
    [lot({ status: "draft" }), null],
  ] as const)("%o is %s", (input, reason) => {
    expect(lockedPremiumReason(input)).toBe(reason);
  });
});

describe("premiumChangedAtDeploy", () => {
  it("flags live and sold-not-invoiced lots whose stored 25% would win over their sale's bands", () => {
    for (const input of [live, soldNotInvoiced]) {
      expect(premiumChangedAtDeploy(input, banded, { preDeploy: false })).toBe(
        lockedPremiumReason(input),
      );
    }
  });

  it("clears them once migration 0375 is applied (or simulated before it)", () => {
    for (const input of [live, soldNotInvoiced]) {
      expect(premiumChangedAtDeploy(input, banded, { preDeploy: true })).toBeNull();
      expect(
        premiumChangedAtDeploy({ ...input, lotRate: null }, banded, { preDeploy: false }),
      ).toBe(null);
    }
  });

  it("leaves lots in a flat-rate sale alone: they keep charging their own rate", () => {
    expect(premiumChangedAtDeploy(live, flat, { preDeploy: true })).toBeNull();
    expect(premiumChangedAtDeploy(soldNotInvoiced, flat, { preDeploy: false })).toBeNull();
  });

  it("ignores invoiced lots, which every surface prices from their invoice", () => {
    const invoiced = { ...soldNotInvoiced, hasLiveInvoice: true };
    expect(premiumChangedAtDeploy(invoiced, banded, { preDeploy: false })).toBeNull();
  });
});
