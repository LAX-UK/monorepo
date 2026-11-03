import { describe, expect, it } from "vitest";
import { marketingEmailError } from "./marketing-email-error.js";

describe("marketingEmailError", () => {
  it("asks for an address when none is typed", () => {
    expect(marketingEmailError("")).toBe("Enter your email address");
    expect(marketingEmailError("   ")).toBe("Enter your email address");
  });

  it("shows the format when the address is malformed", () => {
    for (const value of ["nope", "nope@", "a@b", "a b@c.com"]) {
      expect(marketingEmailError(value)).toBe(
        "Enter an email address in the correct format, like name@example.com",
      );
    }
  });

  it("accepts a usable address, ignoring surrounding space", () => {
    expect(marketingEmailError(" name@example.com ")).toBeNull();
  });
});
