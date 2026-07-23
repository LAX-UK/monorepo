import { describe, expect, it } from "vitest";
import { buildAmlListPageModel } from "./build-aml-list-page-model";

describe("buildAmlListPageModel", () => {
  it("caps page size at 100 and parses screening drawer param", () => {
    const model = buildAmlListPageModel({
      limit: "200",
      offset: "25",
      screening: "screen-1",
    });
    expect(model.query.limit).toBe(100);
    expect(model.query.offset).toBe(25);
    expect(model.selectedScreeningId).toBe("screen-1");
    expect(model.listQueryParams).toEqual({ limit: 100, offset: 25 });
  });

  it("buildPaginationHref preserves drawer state", () => {
    const model = buildAmlListPageModel({ screening: "screen-1", offset: "0" });
    expect(model.buildPaginationHref({ offset: 100 })).toContain("screening=screen-1");
    expect(model.buildPaginationHref({ offset: 100 })).toContain("offset=100");
  });
});
