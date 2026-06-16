import { describe, expect, it } from "vitest";
import { complianceErrorMessage, isSofStaleConflictMessage } from "./compliance-error-messages";

describe("complianceErrorMessage", () => {
  it("humanizes four-eyes errors", () => {
    expect(complianceErrorMessage("aml_review_same_as_triager")).toContain("different MLRO");
  });

  it("passes through unknown messages", () => {
    expect(complianceErrorMessage("Triage failed")).toBe("Triage failed");
  });

  it("humanizes document review errors", () => {
    expect(complianceErrorMessage("source_of_funds_document_superseded")).toContain("superseded");
  });

  it("detects stale conflict messages", () => {
    expect(isSofStaleConflictMessage("source_of_funds_not_pending")).toBe(true);
    expect(
      isSofStaleConflictMessage(complianceErrorMessage("source_of_funds_document_superseded")),
    ).toBe(true);
    expect(isSofStaleConflictMessage("Triage failed")).toBe(false);
  });
});
