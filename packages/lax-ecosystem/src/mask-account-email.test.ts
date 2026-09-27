import { describe, expect, it } from "vitest";
import { maskAccountEmail } from "./mask-account-email.js";

describe("maskAccountEmail", () => {
  it("masks local part", () => {
    expect(maskAccountEmail("mahmoud@example.com")).toBe("m***@example.com");
  });

  it("returns input when not an email shape", () => {
    expect(maskAccountEmail("not-an-email")).toBe("not-an-email");
  });
});
