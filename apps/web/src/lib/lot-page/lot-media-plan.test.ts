import { lotMediaPlan, spreadPages } from "@/lib/lot-page/lot-media-plan";
import { describe, expect, it } from "vitest";

describe("lotMediaPlan", () => {
  it.each([
    ["wall", "single"],
    ["object", "angles"],
    ["product", "angles-zoom"],
    ["showcase", "swipe"],
    ["document", "spread"],
  ] as const)("shows %s as %s", (style, layout) => {
    expect(lotMediaPlan(style, 4).layout).toBe(layout);
  });

  it("names the strip: angles for objects and products, pages for documents", () => {
    expect(lotMediaPlan("object", 3).stripLabel).toBe("Angles");
    expect(lotMediaPlan("product", 3).stripLabel).toBe("Angles");
    expect(lotMediaPlan("document", 3).stripLabel).toBe("Pages");
  });

  it("has no strip for a single picture", () => {
    expect(lotMediaPlan("object", 1).stripLabel).toBeNull();
    expect(lotMediaPlan("wall", 1).stripLabel).toBeNull();
    expect(lotMediaPlan("object", 0).stripLabel).toBeNull();
  });

  it("shows the two faces of a coin side by side", () => {
    expect(lotMediaPlan("product", 2, { pairsTwoFaces: true })).toEqual({
      layout: "faces",
      stripLabel: null,
    });
  });

  it("pairs faces only for exactly two pictures and only where the department does", () => {
    expect(lotMediaPlan("product", 3, { pairsTwoFaces: true }).layout).toBe("angles-zoom");
    expect(lotMediaPlan("product", 1, { pairsTwoFaces: true }).layout).toBe("angles-zoom");
    expect(lotMediaPlan("product", 2).layout).toBe("angles-zoom");
    expect(lotMediaPlan("object", 2, { pairsTwoFaces: true }).layout).toBe("angles");
  });
});

describe("spreadPages", () => {
  it("shows the pair a page falls in", () => {
    expect(spreadPages(0, 6)).toEqual([0, 1]);
    expect(spreadPages(1, 6)).toEqual([0, 1]);
    expect(spreadPages(4, 6)).toEqual([4, 5]);
  });

  it("shows a last odd page alone, and a single picture alone", () => {
    expect(spreadPages(4, 5)).toEqual([4]);
    expect(spreadPages(0, 1)).toEqual([0]);
  });

  it("shows nothing without pictures", () => {
    expect(spreadPages(0, 0)).toEqual([]);
  });
});
