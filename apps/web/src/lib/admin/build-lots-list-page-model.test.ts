import { describe, expect, it } from "vitest";
import { buildLotsListPageModel } from "./build-lots-list-page-model";

describe("buildLotsListPageModel", () => {
  it("resolves live lens to active status", () => {
    const model = buildLotsListPageModel({ lens: "live" }, { withdrawalsPending: 0 });
    expect(model.activeLens).toBe("live");
    expect(model.query.status).toBe("active");
  });

  it("counts advanced filters including search and sort", () => {
    const model = buildLotsListPageModel(
      { q: "vase", sort: "endingAsc", artistId: "a1" },
      { withdrawalsPending: 0 },
    );
    expect(model.advancedFilterCount).toBe(3);
  });

  it("excludes pipeline toggle from filter badge count", () => {
    const model = buildLotsListPageModel(
      { view: "pipeline", q: "test" },
      { withdrawalsPending: 0 },
    );
    expect(model.advancedFilterCount).toBe(1);
  });
});
