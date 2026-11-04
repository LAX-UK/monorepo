import { describe, expect, it } from "vitest";
import { isTextLedSection } from "./art-home-text-led";

describe("isTextLedSection", () => {
  it("is text-led when no item has an image", () => {
    expect(isTextLedSection([{ imageUrl: null }, { imageUrl: "" }])).toBe(true);
  });

  it("keeps the frames when any item has an image", () => {
    expect(isTextLedSection([{ imageUrl: null }, { imageUrl: "/a.webp" }])).toBe(false);
  });

  it("is not text-led when the section is empty", () => {
    expect(isTextLedSection([])).toBe(false);
  });
});
