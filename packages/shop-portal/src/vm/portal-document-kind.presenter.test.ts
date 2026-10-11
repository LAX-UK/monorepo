import { describe, expect, it } from "vitest";
import { resolvePortalDocumentKindLabel } from "./portal-document-kind.presenter.js";

describe("portal document kind presenter", () => {
  it("maps known kinds", () => {
    expect(resolvePortalDocumentKindLabel("certificate")).toBe("Certificate of authenticity");
    expect(resolvePortalDocumentKindLabel("purchase_invoice")).toBe("Purchase invoice");
  });
});
