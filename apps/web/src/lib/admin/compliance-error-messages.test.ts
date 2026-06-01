import { describe, expect, it } from "vitest";
import { complianceErrorMessage } from "./compliance-error-messages";

describe("complianceErrorMessage", () => {
  it("humanizes four-eyes errors", () => {
    expect(complianceErrorMessage("aml_review_same_as_triager")).toContain("different MLRO");
  });

  it("passes through unknown messages", () => {
    expect(complianceErrorMessage("Triage failed")).toBe("Triage failed");
  });
});
