import { describe, expect, it } from "vitest";
import { assignOrders } from "./demo-staff-queues-seed.js";

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
