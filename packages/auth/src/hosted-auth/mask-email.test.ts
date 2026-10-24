import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email.js";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("jane.doe@example.test")).toBe("j***@example.test");
  });

  it("hides a one-letter local part behind the same shape", () => {
    expect(maskEmail("j@example.test")).toBe("j***@example.test");
  });

  it("never echoes something that is not an address", () => {
    expect(maskEmail("not-an-email")).toBe("****");
    expect(maskEmail("@example.test")).toBe("****");
    expect(maskEmail("")).toBe("****");
  });
});
