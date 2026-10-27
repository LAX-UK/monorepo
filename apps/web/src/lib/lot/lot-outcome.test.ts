import { describe, expect, it } from "vitest";
import { lotOutcome, lotWasSold } from "./lot-outcome";

describe("lotOutcome", () => {
  it("is sold when either the winner id or the list flag says so", () => {
    expect(lotOutcome({ winnerId: "buyer-1" })).toBe("sold");
    expect(lotOutcome({ hasWinner: true })).toBe("sold");
    expect(lotOutcome({ winnerId: null, hasWinner: true })).toBe("sold");
  });

  it("is unsold when the lot closed without a winner", () => {
    expect(lotOutcome({ winnerId: null })).toBe("unsold");
    expect(lotOutcome({ hasWinner: false })).toBe("unsold");
  });

  it("is unknown when neither field is present", () => {
    expect(lotOutcome({})).toBe("unknown");
    expect(lotOutcome(undefined)).toBe("unknown");
  });

  it("lotWasSold matches the sold outcome", () => {
    expect(lotWasSold({ hasWinner: true })).toBe(true);
    expect(lotWasSold({ winnerId: null })).toBe(false);
  });
});
