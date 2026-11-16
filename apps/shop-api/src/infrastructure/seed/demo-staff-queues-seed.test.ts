import { describe, expect, it } from "vitest";
import { assignOrders, demoRefundPence } from "./demo-staff-queues-seed.js";

describe("assignOrders", () => {
  it("puts the refund on the first paid order and the dispute on the second", () => {
    expect(assignOrders(["a", "b", "c"])).toEqual({ refund: "a", dispute: "b" });
  });
  it("never puts the refund and the dispute on the same order", () => {
    expect(assignOrders(["a"])).toEqual({ refund: "a", dispute: undefined });
    for (const n of [0, 1, 2, 5]) {
      const { refund, dispute } = assignOrders(Array.from({ length: n }, (_, i) => i));
      if (refund !== undefined && dispute !== undefined) expect(refund).not.toBe(dispute);
    }
  });
  it("has nothing to attach to without a paid order", () => {
    expect(assignOrders([])).toEqual({ refund: undefined, dispute: undefined });
  });
});

describe("demoRefundPence", () => {
  it("refunds a quarter of the order, never all of it and never nothing", () => {
    expect(demoRefundPence(12_000)).toBe(3_000);
    expect(demoRefundPence(3)).toBe(1);
    expect(demoRefundPence(12_000)).toBeLessThan(12_000);
  });
});
