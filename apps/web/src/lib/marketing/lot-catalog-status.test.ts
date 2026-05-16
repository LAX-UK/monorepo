import { describe, expect, it } from "vitest";
import { lotCatalogStatusPresentation } from "./lot-catalog-status";

describe("lotCatalogStatusPresentation", () => {
  it("maps active to live tone", () => {
    expect(lotCatalogStatusPresentation("active")).toEqual({
      label: "live",
      className: "text-live-red",
    });
  });
});
