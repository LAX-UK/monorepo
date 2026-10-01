import { describe, expect, it } from "vitest";
import { isValidUkPostcode } from "./uk-postcode";

describe("isValidUkPostcode", () => {
  it("accepts common UK formats", () => {
    expect(isValidUkPostcode("SW1A 1AA")).toBe(true);
    expect(isValidUkPostcode("sw1a1aa")).toBe(true);
    expect(isValidUkPostcode("EC1A1BB")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidUkPostcode("")).toBe(false);
    expect(isValidUkPostcode("12345")).toBe(false);
  });
});
