import { DEPARTMENT_DISPLAY_STYLES } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { lotCardMediaClasses, lotCardMediaFrame } from "./lot-card-media-frame.js";

describe("lotCardMediaFrame", () => {
  it("gives every picture one frame: the same mat, padding and box, shown whole", () => {
    for (const style of DEPARTMENT_DISPLAY_STYLES) {
      expect(lotCardMediaFrame(style)).toEqual({
        aspect: "aspect-[4/5]",
        inset: "p-[7%]",
        fit: "contain",
        ground: "mat",
        shadow: true,
      });
    }
  });
});

describe("lotCardMediaClasses", () => {
  it("draws the same frame classes for every style, so a product is no longer cropped", () => {
    const wall = lotCardMediaClasses("wall");
    expect(wall.frame).toContain("marketing-work-mat");
    expect(wall.frame).toContain("marketing-lot-wall");
    expect(wall.inset).toBe("p-[7%]");
    expect(wall.image).toContain("object-contain");
    for (const style of DEPARTMENT_DISPLAY_STYLES) {
      expect(lotCardMediaClasses(style)).toEqual(wall);
    }
  });
});
