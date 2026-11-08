import { describe, expect, it } from "vitest";
import {
  type PaymentGroupMemberFacts,
  type PaymentGroupStatus,
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
  type Input = Parameters<typeof decidePaymentGroupSettlement>[0];
  const decide = (input: Omit<Input, "deliveries"> & Partial<Pick<Input, "deliveries">>) =>
    decidePaymentGroupSettlement({ deliveries: [], ...input });

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
    expect(decide({ group, members, received })).toEqual({ apply: true });
  });

  it("does nothing, quietly, for a group that is already paid", () => {
    expect(decide({ group: { ...group, status: "paid" }, members, received })).toEqual({
      apply: false,
      reason: "already_paid",
      alert: false,
    });
  });

  it("applies nothing and alerts when the money is not the total", () => {
    expect(decide({ group, members, received: { ...received, amountPence: 1 } })).toEqual({
      apply: false,
      reason: "amount_mismatch",
      alert: true,
    });
    expect(decide({ group: { ...group, totalPence: 31_000 }, members, received })).toEqual({
      apply: false,
      reason: "amount_mismatch",
      alert: true,
    });
    expect(decide({ group, members, received: { ...received, currency: "eur" } })).toEqual({
      apply: false,
      reason: "currency_mismatch",
      alert: true,
    });
  });

  it("applies nothing and alerts when an invoice changed meanwhile or the group was released", () => {
    expect(
      decide({
        group,
        members: [member("a", 10_000, "captured"), b],
        received,
      }),
    ).toEqual({ apply: false, reason: "member_not_settleable", alert: true });
    expect(decide({ group, members: [], received })).toEqual({
      apply: false,
      reason: "no_members",
      alert: true,
    });
    expect(decide({ group: { ...group, status: "cancelled" }, members, received })).toEqual({
      apply: false,
      reason: "group_released",
      alert: true,
    });
  });

  it("counts a courier quote as part of the total, and only then settles", () => {
    const withDelivery = { ...group, totalPence: 31_800 };
    const deliveries = [{ quoteId: "q1", amountPence: 1_800 }];
    const paid = { ...received, amountPence: 31_800 };
    expect(decide({ group: withDelivery, members, deliveries, received: paid })).toEqual({
      apply: true,
    });
    // The invoices alone no longer add up to the total.
    expect(decide({ group: withDelivery, members, received: paid })).toEqual({
      apply: false,
      reason: "amount_mismatch",
      alert: true,
    });
    // Money for the invoices only is not enough for a payment that includes delivery.
    expect(decide({ group: withDelivery, members, deliveries, received })).toEqual({
      apply: false,
      reason: "amount_mismatch",
      alert: true,
    });
  });
});

describe("attributeGroupRefunds", () => {
  it("adds refunds up per invoice and never spreads one it cannot place", () => {
    const result = attributeGroupRefunds(
      [
        { paymentId: "a", amountPence: 1000 },
        { paymentId: "b", amountPence: 1000 },
      ],
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

  it("caps each invoice at its own amount and reports the excess as unattributed", () => {
    const result = attributeGroupRefunds(
      [
        { paymentId: "a", amountPence: 1000 },
        { paymentId: "b", amountPence: 500 },
      ],
      [
        { paymentId: "a", amountPence: 800 },
        { paymentId: "a", amountPence: 800 },
        { paymentId: "b", amountPence: 500 },
        { paymentId: "b", amountPence: 1 },
      ],
    );
    expect(result.refundedPenceByPayment).toEqual(
      new Map([
        ["a", 1000],
        ["b", 500],
      ]),
    );
    expect(result.unattributedPence).toBe(601);
  });
});
