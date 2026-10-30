import { describe, expect, it } from "vitest";
import {
  type PaymentGroupMemberFacts,
  type PaymentGroupStatus,
  allocateGroupDispute,
  attributeGroupRefunds,
  decidePaymentGroupSettlement,
  paymentGroupIsLive,
  paymentGroupTransition,
} from "./payment-group.js";

describe("paymentGroupTransition", () => {
  it("moves an open group to processing, paid or cancelled", () => {
    expect(paymentGroupTransition("open", "funds_processing")).toBe("processing");
    expect(paymentGroupTransition("open", "succeeded")).toBe("paid");
    expect(paymentGroupTransition("open", "released")).toBe("cancelled");
    expect(paymentGroupTransition("processing", "succeeded")).toBe("paid");
    expect(paymentGroupTransition("processing", "released")).toBe("cancelled");
  });

  it("ignores late or repeated events once a group is settled or released", () => {
    const settled: PaymentGroupStatus[] = ["paid", "cancelled"];
    for (const from of settled) {
      expect(paymentGroupTransition(from, "funds_processing")).toBeNull();
      expect(paymentGroupTransition(from, "succeeded")).toBeNull();
      expect(paymentGroupTransition(from, "released")).toBeNull();
    }
    // A bank transfer notice arriving after the money is never a step back.
    expect(paymentGroupTransition("processing", "funds_processing")).toBeNull();
  });

  it("holds its invoices only while open or processing", () => {
    expect(paymentGroupIsLive("open")).toBe(true);
    expect(paymentGroupIsLive("processing")).toBe(true);
    expect(paymentGroupIsLive("paid")).toBe(false);
    expect(paymentGroupIsLive("cancelled")).toBe(false);
  });
});

describe("decidePaymentGroupSettlement", () => {
  const member = (
    paymentId: string,
    amountPence: number,
    status: PaymentGroupMemberFacts["status"] = "pending",
  ): PaymentGroupMemberFacts => ({ paymentId, amountPence, status });
  const group = { status: "open" as PaymentGroupStatus, totalPence: 30_000, currency: "GBP" };
  const a = member("a", 10_000);
  const b = member("b", 20_000, "authorized");
  const members = [a, b];
  const received = { amountPence: 30_000, currency: "gbp" };

  it("settles every invoice when the money matches the total", () => {
    expect(decidePaymentGroupSettlement({ group, members, received })).toEqual({ apply: true });
  });

  it("does nothing, quietly, for a group that is already paid", () => {
    expect(
      decidePaymentGroupSettlement({ group: { ...group, status: "paid" }, members, received }),
    ).toEqual({ apply: false, reason: "already_paid", alert: false });
  });

  it("applies nothing and alerts when the money is not the total", () => {
    expect(
      decidePaymentGroupSettlement({ group, members, received: { ...received, amountPence: 1 } }),
    ).toEqual({ apply: false, reason: "amount_mismatch", alert: true });
    expect(
      decidePaymentGroupSettlement({ group: { ...group, totalPence: 31_000 }, members, received }),
    ).toEqual({ apply: false, reason: "amount_mismatch", alert: true });
    expect(
      decidePaymentGroupSettlement({ group, members, received: { ...received, currency: "eur" } }),
    ).toEqual({ apply: false, reason: "currency_mismatch", alert: true });
  });

  it("applies nothing and alerts when an invoice changed meanwhile or the group was released", () => {
    expect(
      decidePaymentGroupSettlement({
        group,
        members: [member("a", 10_000, "captured"), b],
        received,
      }),
    ).toEqual({ apply: false, reason: "member_not_settleable", alert: true });
    expect(decidePaymentGroupSettlement({ group, members: [], received })).toEqual({
      apply: false,
      reason: "no_members",
      alert: true,
    });
    expect(
      decidePaymentGroupSettlement({ group: { ...group, status: "cancelled" }, members, received }),
    ).toEqual({ apply: false, reason: "group_released", alert: true });
  });
});

describe("attributeGroupRefunds", () => {
  it("adds refunds up per invoice and never spreads one it cannot place", () => {
    const result = attributeGroupRefunds(
      ["a", "b"],
      [
        { paymentId: "a", amountPence: 500 },
        { paymentId: "a", amountPence: 250 },
        { paymentId: null, amountPence: 100 },
        { paymentId: "z", amountPence: 40 },
      ],
    );
    expect(result.refundedPenceByPayment).toEqual(new Map([["a", 750]]));
    expect(result.unattributedPence).toBe(140);
  });
});

describe("allocateGroupDispute", () => {
  const members = [
    { paymentId: "a", amountPence: 10_000 },
    { paymentId: "b", amountPence: 20_000 },
  ];

  it("falls on every invoice in full when the whole payment is disputed", () => {
    expect(allocateGroupDispute(30_000, members)).toEqual(members);
  });

  it("asks the finance team when only part of it is disputed", () => {
    expect(allocateGroupDispute(10_000, members)).toBeNull();
    expect(allocateGroupDispute(0, [])).toBeNull();
  });
});
