import { describe, expect, it } from "vitest";
import { cardLimitLabel, payMethodsVm, usableMethod } from "./pay-methods";
import { LOT_A, payable, planOf } from "./pay-plan-fixtures.test-util";

const small = () => planOf([payable(LOT_A, 190_000, 47_500)]);
const overCard = () => planOf([payable(LOT_A, 1_200_000, 300_000)]);

describe("payMethodsVm", () => {
  it("offers both within the card limit, with card chosen first", () => {
    const vm = payMethodsVm(small());
    expect(vm?.defaultMethod).toBe("card");
    expect(vm?.options.map((o) => [o.method, o.disabledReason])).toEqual([
      ["card", null],
      ["bank_transfer", null],
    ]);
  });

  it("shows card as unavailable above the limit, with the server's limit in the reason", () => {
    const vm = payMethodsVm(overCard());
    expect(vm?.defaultMethod).toBe("bank_transfer");
    expect(vm?.options[0]?.disabledReason).toBe(
      "Card payments go up to £10,000. Pick fewer invoices to pay by card.",
    );
    expect(vm?.options[1]?.disabledReason).toBeNull();
  });

  it("takes the limit from the plan, not from a constant", () => {
    const plan = overCard();
    plan.cardLimitPence = 2_500_000;
    plan.methods = [
      { method: "card", available: false, reason: "over_card_limit" },
      { method: "bank_transfer", available: true, reason: null },
    ];
    expect(payMethodsVm(plan)?.options[0]?.disabledReason).toContain("£25,000.");
  });

  it("offers nothing when no method is open", () => {
    const plan = small();
    plan.methods = [
      { method: "card", available: false, reason: "over_online_limit" },
      { method: "bank_transfer", available: false, reason: "over_online_limit" },
    ];
    expect(payMethodsVm(plan)).toBeNull();
  });
});

describe("cardLimitLabel", () => {
  it("writes whole pounds without pence", () => {
    expect(cardLimitLabel(1_000_000)).toBe("£10,000");
    expect(cardLimitLabel(10_000_000)).toBe("£100,000");
  });
});

describe("usableMethod", () => {
  it("keeps a remembered method that is still open", () => {
    const vm = payMethodsVm(small());
    if (!vm) throw new Error("expected methods");
    expect(usableMethod(vm, "bank_transfer")).toBe("bank_transfer");
  });

  it("falls back to the default when the remembered method is no longer open", () => {
    const vm = payMethodsVm(overCard());
    if (!vm) throw new Error("expected methods");
    expect(usableMethod(vm, "card")).toBe("bank_transfer");
  });

  it("ignores anything it does not know", () => {
    const vm = payMethodsVm(small());
    if (!vm) throw new Error("expected methods");
    expect(usableMethod(vm, "cash")).toBe("card");
    expect(usableMethod(vm, null)).toBe("card");
  });
});
