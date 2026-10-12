import { describe, expect, it } from "vitest";
import { editorialPageHref } from "./editorial-page-routes.js";

describe("editorialPageHref", () => {
  it("routes guides, legal pages and Collector Hub service pages to one canonical URL", () => {
    expect(editorialPageHref("how-to-buy")).toBe("/how-to-buy");
    expect(editorialPageHref("how-to-sell")).toBe("/how-to-sell");
    expect(editorialPageHref("101-guide")).toBe("/collector-hub/101-guide");
    expect(editorialPageHref("privacy")).toBe("/legal/privacy");
    expect(editorialPageHref("art-advisory")).toBe("/collector-hub/art-advisory");
  });

  it("does not treat inherited object keys as guides", () => {
    expect(editorialPageHref("toString")).toBe("/collector-hub/toString");
  });
});
