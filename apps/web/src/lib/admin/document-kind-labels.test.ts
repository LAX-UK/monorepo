import { describe, expect, it } from "vitest";
import { documentKindLabel } from "./document-kind-labels";

describe("documentKindLabel", () => {
  it("maps sale document kinds", () => {
    expect(documentKindLabel("terms")).toBe("Terms of sale (PDF)");
    expect(documentKindLabel("catalog")).toBe("Sale catalogue");
  });

  it("maps lot document kinds", () => {
    expect(documentKindLabel("condition_report")).toBe("Condition report");
    expect(documentKindLabel("provenance")).toBe("Provenance");
  });

  it("title-cases unknown kinds", () => {
    expect(documentKindLabel("custom_kind")).toBe("Custom Kind");
  });
});
