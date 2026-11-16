import { describe, expect, it } from "vitest";
import { assignOrders, demoRefundPence } from "./demo-staff-queues-seed.js";

describe("assignOrders", () => {
  it("puts the refund on the first paid order and the dispute on the second", () => {
    expect(assignOrders(["a", "b", "c"])).toEqual({ refund: "a", dispute: "b" });
  });
  it("puts both on the only paid order", () => {
    expect(assignOrders(["a"])).toEqual({ refund: "a", dispute: "a" });
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
