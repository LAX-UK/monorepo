import { describe, expect, it } from "vitest";
import { buildSalesListPageModel } from "./build-sales-list-page-model";

describe("buildSalesListPageModel", () => {
  it("resolves setup lens with draft status and needsSetup query", () => {
    const model = buildSalesListPageModel({ lens: "setup" });
    expect(model.activeLensId).toBe("setup");
    expect(model.setupLens).toBe(true);
    expect(model.query.status).toBe("draft");
    expect(model.query.needsSetup).toBe(true);
  });

  it("counts search and sort in active filter badge", () => {
    const model = buildSalesListPageModel({ q: "spring", sort: "startAsc" });
    expect(model.activeFilterCount).toBe(2);
  });

  it("provides setup lens empty copy", () => {
    const model = buildSalesListPageModel({ lens: "setup" });
    expect(model.salesEmptyDescription).toContain("fully set up");
  });
});
