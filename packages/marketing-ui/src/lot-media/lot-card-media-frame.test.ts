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

  it("fills a square for a product and a 3:2 frame for a showcase", () => {
    expect(lotCardMediaFrame("product")).toMatchObject({ aspect: "aspect-square", fit: "cover" });
    expect(lotCardMediaFrame("showcase")).toMatchObject({ aspect: "aspect-[3/2]", fit: "cover" });
  });

  it("shows a document whole at page ratio", () => {
    expect(lotCardMediaFrame("document")).toMatchObject({
      aspect: "aspect-[3/4]",
      fit: "contain",
    });
  });

  it("leaves no room around a picture that fills its frame", () => {
    for (const style of DEPARTMENT_DISPLAY_STYLES) {
      const frame = lotCardMediaFrame(style);
      expect(frame.inset === "p-0").toBe(frame.fit === "cover");
    }
  });
});

describe("lotCardMediaClasses", () => {
  it("puts the shadow class on wall frames only", () => {
    expect(lotCardMediaClasses("wall").frame).toContain("marketing-lot-wall");
    expect(lotCardMediaClasses("wall").frame).toContain("marketing-work-mat");
    for (const style of ["object", "product", "showcase", "document"] as const) {
      expect(lotCardMediaClasses(style).frame).not.toContain("marketing-lot-wall");
      expect(lotCardMediaClasses(style).frame).toContain("marketing-studio-ground");
    }
  });

  it("fits the image by the style", () => {
    expect(lotCardMediaClasses("object").image).toContain("object-contain");
    expect(lotCardMediaClasses("product").image).toContain("object-cover");
  });
});
