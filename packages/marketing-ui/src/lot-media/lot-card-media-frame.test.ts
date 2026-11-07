import { DEPARTMENT_DISPLAY_STYLES } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { lotCardMediaClasses, lotCardMediaFrame } from "./lot-card-media-frame.js";

describe("lotCardMediaFrame", () => {
  it("shows a wall work whole at its ratio with the wall shadow", () => {
    expect(lotCardMediaFrame("wall")).toMatchObject({
      fit: "contain",
      ground: "mat",
      shadow: true,
    });
  });

  it("shows an object whole on the studio ground, without a shadow", () => {
    expect(lotCardMediaFrame("object")).toMatchObject({
      fit: "contain",
      ground: "studio",
      shadow: false,
    });
  });

  it("gives every style the same 4:5 box, so a mixed row lines up", () => {
    for (const style of DEPARTMENT_DISPLAY_STYLES) {
      expect(lotCardMediaFrame(style).aspect).toBe("aspect-[4/5]");
    }
  });

  it("fills the box for a product", () => {
    expect(lotCardMediaFrame("product")).toMatchObject({ fit: "cover", inset: "p-0" });
  });

  it("shows a showcase whole across the full width of the box", () => {
    expect(lotCardMediaFrame("showcase")).toMatchObject({
      fit: "contain",
      inset: "p-0",
      ground: "studio",
    });
  });

  it("shows a document page whole on the mat, without a shadow", () => {
    expect(lotCardMediaFrame("document")).toMatchObject({
      fit: "contain",
      ground: "mat",
      shadow: false,
    });
  });
});

describe("lotCardMediaClasses", () => {
  it("puts the shadow class on wall frames only", () => {
    expect(lotCardMediaClasses("wall").frame).toContain("marketing-lot-wall");
    expect(lotCardMediaClasses("wall").frame).toContain("marketing-work-mat");
    for (const style of ["object", "product", "showcase", "document"] as const) {
      expect(lotCardMediaClasses(style).frame).not.toContain("marketing-lot-wall");
    }
    expect(lotCardMediaClasses("object").frame).toContain("marketing-studio-ground");
  });

  it("fits the image by the style", () => {
    expect(lotCardMediaClasses("object").image).toContain("object-contain");
    expect(lotCardMediaClasses("product").image).toContain("object-cover");
  });
});
