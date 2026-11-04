import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "./constant-time-equal.js";

describe("constantTimeEqual", () => {
  it("matches equal secrets", () => {
    expect(constantTimeEqual("s3cret-token", "s3cret-token")).toBe(true);
  });

  it("refuses a different secret of the same length", () => {
    expect(constantTimeEqual("s3cret-token", "s3cret-tokeX")).toBe(false);
  });

  it("refuses a different length, including multi-byte text", () => {
    expect(constantTimeEqual("token", "token-longer")).toBe(false);
    expect(constantTimeEqual("é", "e")).toBe(false);
  });
});
