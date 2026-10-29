import { legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buyerEntityCanBid, buyerEntityCanRegister } from "./buyer-entity-bid-eligibility.js";

describe("buyerEntityCanBid", () => {
  it("allows approved and connect_pending", () => {
    expect(buyerEntityCanBid("approved")).toBe(true);
    expect(buyerEntityCanBid("connect_pending")).toBe(true);
  });

  it("refuses a restricted organisation and every pre-bid or closed status", () => {
    for (const status of [
      "lead",
      "docs_requested",
      "docs_received",
      "under_review",
      "restricted",
      "rejected",
      "archived",
    ] as const) {
      expect(buyerEntityCanBid(status)).toBe(false);
    }
  });

  it("covers every legal entity status explicitly, and registering agrees", () => {
    const eligible = new Set(["approved", "connect_pending"]);
    for (const status of legalEntityStatuses) {
      expect(buyerEntityCanBid(status)).toBe(eligible.has(status));
      expect(buyerEntityCanRegister(status)).toBe(eligible.has(status));
    }
  });
});
