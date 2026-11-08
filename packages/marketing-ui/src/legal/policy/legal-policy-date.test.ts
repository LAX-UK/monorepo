import { formatLegalDocumentDate } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { formatLegalPolicyDate } from "./legal-policy-page.js";

describe("formatLegalPolicyDate", () => {
  it("writes September in full, never 'Sept'", () => {
    expect(formatLegalPolicyDate("2026-09-12")).toBe("12 September 2026");
  });

  it("uses the shared policy date style for every month", () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2026-${String(month).padStart(2, "0")}-05`;
      expect(formatLegalPolicyDate(iso)).toBe(formatLegalDocumentDate(iso));
    }
    expect(formatLegalPolicyDate("2026-06-17")).toBe("17 June 2026");
  });
});
