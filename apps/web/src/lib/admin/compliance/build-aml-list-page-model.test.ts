import { describe, expect, it } from "vitest";
import { buildAmlListPageModel } from "./build-aml-list-page-model";

describe("buildAmlListPageModel", () => {
  it("reads an offered page size, the offset and the open screening", () => {
    const model = buildAmlListPageModel({ limit: "100", offset: "25", screening: " screen-1 " });
    expect(model.query).toEqual({ limit: 100, offset: 25 });
    expect(model.selectedScreeningId).toBe("screen-1");
    expect(model.listQueryParams).toEqual({ limit: 100, offset: 25 });
  });

  it("falls back to 50 rows for a size the list does not offer", () => {
    expect(buildAmlListPageModel({ limit: "5000" }).query.limit).toBe(50);
    expect(buildAmlListPageModel({}).query.limit).toBe(50);
  });

  it("ignores a bad offset", () => {
    expect(buildAmlListPageModel({ offset: "-4" }).query.offset).toBe(0);
    expect(buildAmlListPageModel({ offset: "abc" }).query.offset).toBe(0);
  });
});
