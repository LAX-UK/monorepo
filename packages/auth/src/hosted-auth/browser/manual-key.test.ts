import { describe, expect, it } from "vitest";
import { formatManualKey } from "./manual-key.js";

describe("formatManualKey", () => {
  it("groups the secret in fours without a trailing space", () => {
    expect(formatManualKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(formatManualKey("ABCDEF")).toBe("ABCD EF");
  });

  it("normalises existing whitespace", () => {
    expect(formatManualKey(" JBSW Y3DP\n")).toBe("JBSW Y3DP");
  });
});
