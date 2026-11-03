import { describe, expect, it } from "vitest";
import {
  LOT_CONFIRMED_FOR_RETURN_MESSAGE,
  relistReserveToApply,
  unsoldFollowUpFinishedByStaff,
  unsoldFollowUpPlan,
} from "./unsold-follow-up.js";

describe("unsoldFollowUpPlan", () => {
  it("carries the agreed reserve for a relist", () => {
    expect(unsoldFollowUpPlan({ decidedChoice: "relist", decidedReserve: "4200.00" })).toEqual({
      kind: "relist",
      reserve: "4200.00",
    });
  });

  it("keeps the current reserve when the relist agreed none", () => {
    expect(
      unsoldFollowUpPlan({ decidedChoice: "relist", decidedReserve: null })?.reserve,
    ).toBeNull();
    expect(
      unsoldFollowUpPlan({ decidedChoice: "relist", decidedReserve: "0" })?.reserve,
    ).toBeNull();
  });

  it("never carries a reserve for a return or a private sale", () => {
    expect(unsoldFollowUpPlan({ decidedChoice: "collect", decidedReserve: "4200.00" })).toEqual({
      kind: "collect",
      reserve: null,
    });
    expect(
      unsoldFollowUpPlan({ decidedChoice: "private_sale", decidedReserve: "1" })?.reserve,
    ).toBe(null);
  });

  it("opens nothing for a choice nobody confirmed", () => {
    expect(unsoldFollowUpPlan({ decidedChoice: null, decidedReserve: null })).toBeNull();
  });
});

describe("relistReserveToApply", () => {
  const open = {
    kind: "relist" as const,
    status: "open" as const,
    reserve: "4200.00",
    reserveAppliedAt: null,
  };

  it("applies the agreed reserve while the relist is open", () => {
    expect(relistReserveToApply(open)).toBe("4200.00");
  });

  it("applies it once", () => {
    expect(relistReserveToApply({ ...open, reserveAppliedAt: new Date() })).toBeNull();
    expect(relistReserveToApply({ ...open, status: "done" })).toBeNull();
  });

  it("applies nothing for other work or when no reserve was agreed", () => {
    expect(relistReserveToApply({ ...open, kind: "collect" })).toBeNull();
    expect(relistReserveToApply({ ...open, reserve: null })).toBeNull();
  });
});

describe("who finishes the work", () => {
  it("leaves a relist to finish itself, and the other two to staff", () => {
    expect(unsoldFollowUpFinishedByStaff("relist")).toBe(false);
    expect(unsoldFollowUpFinishedByStaff("collect")).toBe(true);
    expect(unsoldFollowUpFinishedByStaff("private_sale")).toBe(true);
  });

  it("explains the refusal without system terms", () => {
    expect(LOT_CONFIRMED_FOR_RETURN_MESSAGE).toMatch(/return/);
  });
});
