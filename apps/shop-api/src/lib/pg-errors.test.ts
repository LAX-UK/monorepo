import { describe, expect, it } from "vitest";
import { isPgUniqueViolation } from "./pg-errors.js";

describe("isPgUniqueViolation", () => {
  it("detects nested postgres unique violations", () => {
    const error = { cause: { code: "23505" } };
    expect(isPgUniqueViolation(error)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPgUniqueViolation(new Error("nope"))).toBe(false);
  });
});
