import {
  createPaddleRegistrationValidator,
  createPaddleRosterLookup,
  validatePaddleRegistration,
} from "@/features/saleroom/lib/paddle-roster-validation";
import { describe, expect, it } from "vitest";

const roster = [
  { paddleNumber: 142, displayName: "Jane Doe" },
  { paddleNumber: 205, displayName: "John Smith" },
] as const;

describe("paddle-roster-validation", () => {
  it("finds a registered paddle in the roster lookup", () => {
    const lookup = createPaddleRosterLookup(roster);
    expect(lookup.findByPaddleNumber(142)?.displayName).toBe("Jane Doe");
    expect(lookup.findByPaddleNumber(999)).toBeNull();
  });

  it("rejects invalid paddle format before roster lookup", () => {
    const lookup = createPaddleRosterLookup(roster);
    expect(validatePaddleRegistration("12", lookup)).toMatch(/valid paddle number/);
  });

  it("rejects paddles that are not checked in for the sale", () => {
    const lookup = createPaddleRosterLookup(roster);
    expect(validatePaddleRegistration("999", lookup)).toBe("Paddle not checked in for this sale");
  });

  it("accepts a registered paddle number", () => {
    const validate = createPaddleRegistrationValidator(roster);
    expect(validate("142")).toBeNull();
  });
});
