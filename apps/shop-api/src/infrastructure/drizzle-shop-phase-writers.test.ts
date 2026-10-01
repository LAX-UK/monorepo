import { canTransitionFulfilmentStatus } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";

describe("fulfilment transitions (domain)", () => {
  it("allows pending_production to in_production", () => {
    expect(canTransitionFulfilmentStatus("pending_production", "in_production")).toBe(true);
  });

  it("rejects pending_production to delivered", () => {
    expect(canTransitionFulfilmentStatus("pending_production", "delivered")).toBe(false);
  });
});
