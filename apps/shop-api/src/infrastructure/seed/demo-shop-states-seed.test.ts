import { describe, expect, it } from "vitest";
import {
  DEMO_ORIGINAL_BUYER_SUBJECT,
  DEMO_STATES_ACTOR,
  DISPATCHED_ORDER_KEY,
  DemoShopStatesPreconditionError,
  RETURNED_ORDER_KEY,
} from "./demo-shop-states-seed.js";
import { assignOrders } from "./demo-staff-queues-seed.js";
import { NUMBERED_RUN_SLUGS, orderKey } from "./edition-orders-seed.js";

describe("the orders the states use", () => {
  const keys = NUMBERED_RUN_SLUGS.map(orderKey);

  it("are demo orders the edition orders seed makes", () => {
    expect(keys).toContain(DISPATCHED_ORDER_KEY);
    expect(keys).toContain(RETURNED_ORDER_KEY);
    expect(DISPATCHED_ORDER_KEY).not.toBe(RETURNED_ORDER_KEY);
  });

  it("never share an order with the refund or the dispute of the queues seed", () => {
    // The queues seed picks by position among the paid demo orders sorted by key; whichever of
    // them are still paid, it must never pick an order the states seed has named.
    const sorted = [...keys].sort();
    for (let drop = 0; drop <= sorted.length; drop++) {
      const paid = sorted.filter((_, i) => i !== drop);
      const { refund, dispute } = assignOrders(paid);
      for (const used of [refund, dispute]) {
        if (used === DISPATCHED_ORDER_KEY || used === RETURNED_ORDER_KEY) {
          // Only once an earlier order is no longer paid can the position reach a named order;
          // the states seed has dispatched it by then, which the queues seed leaves alone.
          expect(drop).toBeLessThan(sorted.indexOf(used));
        }
      }
    }
    const { refund, dispute } = assignOrders(sorted);
    expect([refund, dispute]).not.toContain(DISPATCHED_ORDER_KEY);
    expect([refund, dispute]).not.toContain(RETURNED_ORDER_KEY);
  });
});

describe("a missing precondition", () => {
  it("names every missing state and says what to run", () => {
    const error = new DemoShopStatesPreconditionError([
      "dispatched order: a",
      "reserved original: b",
    ]);
    expect(error.message).toContain("- dispatched order: a");
    expect(error.message).toContain("- reserved original: b");
    expect(error.message).toContain("seed:catalogue");
  });
});

describe("demo identities", () => {
  it("are marked as the seed", () => {
    expect(DEMO_STATES_ACTOR).toMatch(/^seed:/);
    expect(DEMO_ORIGINAL_BUYER_SUBJECT).toMatch(/^seed:/);
  });
});
