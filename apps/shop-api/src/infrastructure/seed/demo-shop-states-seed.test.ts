import { describe, expect, it } from "vitest";
import {
  DEMO_ORIGINAL_BUYER_SUBJECT,
  DEMO_STATES_ACTOR,
  assignStateOrders,
} from "./demo-shop-states-seed.js";
import { assignOrders } from "./demo-staff-queues-seed.js";

describe("assignStateOrders", () => {
  it("dispatches the third paid order and returns the fourth", () => {
    expect(assignStateOrders(["a", "b", "c", "d"])).toEqual({ dispatched: "c", returned: "d" });
  });
  it("never shares an order with the refund or the dispute of the queues seed", () => {
    for (const n of [0, 1, 2, 3, 4, 6]) {
      const orders = Array.from({ length: n }, (_, i) => i);
      const queues = assignOrders(orders);
      const states = assignStateOrders(orders);
      const used = [queues.refund, queues.dispute, states.dispatched, states.returned].filter(
        (o) => o !== undefined,
      );
      expect(new Set(used).size).toBe(used.length);
    }
  });
  it("has nothing to attach to without enough paid orders", () => {
    expect(assignStateOrders(["a", "b"])).toEqual({ dispatched: undefined, returned: undefined });
  });
});

describe("demo identities", () => {
  it("are marked as the seed", () => {
    expect(DEMO_STATES_ACTOR).toMatch(/^seed:/);
    expect(DEMO_ORIGINAL_BUYER_SUBJECT).toMatch(/^seed:/);
  });
});
