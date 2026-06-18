import { legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buyerEntityCanBid } from "./buyer-entity-bid-eligibility.js";

describe("buyerEntityCanBid", () => {
  it("allows approved, restricted, and connect_pending", () => {
    expect(buyerEntityCanBid("approved")).toBe(true);
    expect(buyerEntityCanBid("restricted")).toBe(true);
    expect(buyerEntityCanBid("connect_pending")).toBe(true);
  });

  it("rejects pre-bid lifecycle statuses", () => {
    for (const status of [
      "lead",
      "docs_requested",
      "docs_received",
      "under_review",
      "rejected",
      "archived",
    ] as const) {
      expect(buyerEntityCanBid(status)).toBe(false);
    }
  });

  it("covers every legal entity status explicitly", () => {
    const eligible = new Set(["approved", "restricted", "connect_pending"]);
    for (const status of legalEntityStatuses) {
      expect(buyerEntityCanBid(status)).toBe(eligible.has(status));
    }
  });
});
