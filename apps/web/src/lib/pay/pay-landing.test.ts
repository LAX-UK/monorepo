import { describe, expect, it } from "vitest";
import { belongsToAnotherAccount, payLandingRedirect } from "./pay-landing";
import { payLinkProblemVm, payRefusalVm } from "./pay-link-vm";
import { LOT_A, LOT_B, payable, planOf } from "./pay-plan-fixtures.test-util";

describe("payLandingRedirect", () => {
  it("opens the purchase of a single lot that is already paid", () => {
    const plan = planOf([], { leftOut: [{ lotId: LOT_A, reason: "paid" }] });
    expect(payLandingRedirect([LOT_A], plan)).toBe(`/purchases/${LOT_A}?paid=1`);
  });

  it("stays on the Pay page for anything still to pay", () => {
    expect(payLandingRedirect([LOT_A], planOf([payable(LOT_A, 100, 25)]))).toBeNull();
  });

  it("stays on the Pay page for a payment being confirmed", () => {
    const plan = planOf([], { leftOut: [{ lotId: LOT_A, reason: "being_confirmed" }] });
    expect(payLandingRedirect([LOT_A], plan)).toBeNull();
  });

  it("opens the first lot of several that are all paid, saying how many were paid", () => {
    const plan = planOf([], {
      leftOut: [
        { lotId: LOT_A, reason: "paid" },
        { lotId: LOT_B, reason: "paid" },
      ],
    });
    expect(payLandingRedirect([LOT_A, LOT_B], plan)).toBe(`/purchases/${LOT_A}?paid=2`);
  });

  it("stays on the Pay page when only some of several lots are paid", () => {
    const plan = planOf([], {
      leftOut: [
        { lotId: LOT_A, reason: "paid" },
        { lotId: LOT_B, reason: "other_account" },
      ],
    });
    expect(payLandingRedirect([LOT_A, LOT_B], plan)).toBeNull();
  });
});

describe("belongsToAnotherAccount", () => {
  it("is true when every lot was won for another account", () => {
    const plan = planOf([], { leftOut: [{ lotId: LOT_A, reason: "other_account" }] });
    expect(belongsToAnotherAccount(plan)).toBe(true);
  });

  it("is false when anything can be paid here, or something else is the reason", () => {
    expect(
      belongsToAnotherAccount(
        planOf([payable(LOT_A, 100, 25)], { leftOut: [{ lotId: LOT_B, reason: "other_account" }] }),
      ),
    ).toBe(false);
    expect(
      belongsToAnotherAccount(planOf([], { leftOut: [{ lotId: LOT_A, reason: "paid" }] })),
    ).toBe(false);
    expect(belongsToAnotherAccount(planOf([]))).toBe(false);
  });
});

describe("a link or a refusal with nothing to show", () => {
  it("explains a link with no lots, an unusable one and one with too many", () => {
    expect(payLinkProblemVm({ kind: "none" }).empty?.description).toMatch(/Choose the invoices/);
    expect(payLinkProblemVm({ kind: "invalid" }).empty?.description).toMatch(
      /doesn't name any lots/,
    );
    const many = payLinkProblemVm({ kind: "too_many" });
    expect(many.empty?.title).toBe("Choose fewer invoices");
    expect(many.empty?.description).toMatch(/up to 20 invoices/);
    for (const vm of [many, payLinkProblemVm({ kind: "none" })]) {
      expect(vm.action).toBeNull();
      expect(vm.empty?.action).toEqual({ label: "Open purchases", href: "/purchases" });
    }
  });

  it("tells a suspended account, a staff account and a role that does not pay", () => {
    expect(payRefusalVm("suspended").empty?.title).toBe("Your account is suspended");
    expect(payRefusalVm("staff").empty?.title).toBe("Staff accounts don't pay for lots");
    expect(payRefusalVm("no_role").empty?.title).toBe("Your role doesn't cover payments");
    expect(payRefusalVm("bad_pick").empty?.title).toBe("Choose fewer invoices");
    expect(payRefusalVm("suspended").empty?.illustration).toBe("lock");
  });
});
