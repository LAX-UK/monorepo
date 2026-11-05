import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  buildLotMediaTreatmentIndex,
  departmentDisplayStyle,
  departmentMediaTreatment,
  lotMediaTreatment,
} from "./departments.js";

describe("DEPARTMENTS", () => {
  it("lists twelve departments with unique slugs", () => {
    expect(DEPARTMENTS).toHaveLength(12);
    expect(new Set(DEPARTMENTS.map((d) => d.slug)).size).toBe(12);
  });
});

describe("departmentDisplayStyle", () => {
  it.each([
    ["paintings", "wall"],
    ["drawings", "wall"],
    ["photography", "wall"],
    ["fine-prints", "wall"],
    ["digital-art", "wall"],
    ["mixed-media", "wall"],
    ["sculpture", "object"],
    ["design-decorative-arts", "object"],
    ["watches-clocks", "product"],
    ["coins-medals", "product"],
    ["motor-cars", "showcase"],
    ["books-manuscripts", "document"],
  ])("%s is %s", (slug, style) => {
    expect(departmentDisplayStyle(slug)).toBe(style);
  });

  it("shows anything else as a wall work", () => {
    expect(departmentDisplayStyle("jewellery")).toBe("wall");
    expect(departmentDisplayStyle(null)).toBe("wall");
  });
});

describe("lot media treatment", () => {
  const index = buildLotMediaTreatmentIndex([
    { id: "c-coins", slug: "coins-medals" },
    { id: "c-cars", slug: "motor-cars" },
    { id: "c-other", slug: "antiques" },
  ]);

  it("pairs the two faces of coins only", () => {
    expect(departmentMediaTreatment("coins-medals")).toEqual({
      style: "product",
      pairsTwoFaces: true,
    });
    expect(departmentMediaTreatment("watches-clocks").pairsTwoFaces).toBe(false);
  });

  it("leaves categories outside the twelve out of the index", () => {
    expect(Object.keys(index).sort()).toEqual(["c-cars", "c-coins"]);
  });

  it("takes the first category that is a department", () => {
    expect(lotMediaTreatment({ categoryIds: ["c-other", "c-cars"] }, index).style).toBe("showcase");
  });

  it("falls back to the single category id, then to a wall work", () => {
    expect(lotMediaTreatment({ categoryId: "c-coins" }, index).style).toBe("product");
    expect(lotMediaTreatment({}, index).style).toBe("wall");
  });
});
