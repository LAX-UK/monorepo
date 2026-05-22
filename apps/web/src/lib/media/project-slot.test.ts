import { describe, expect, it } from "vitest";
import {
  isMaterialRectChange,
  projectSlotToImageSpace,
  serializeRect,
  visibleImageRect,
} from "./project-slot";

describe("visibleImageRect", () => {
  it("cover fills container", () => {
    const rect = visibleImageRect(
      { width: 400, height: 300 },
      { naturalWidth: 800, naturalHeight: 600 },
      "cover",
    );
    expect(rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("contain portrait in landscape letterboxes horizontally", () => {
    const rect = visibleImageRect(
      { width: 400, height: 300 },
      { naturalWidth: 600, naturalHeight: 800 },
      "contain",
    );
    expect(rect.x).toBeGreaterThan(0);
    expect(rect.w).toBeLessThan(1);
    expect(rect.y).toBe(0);
    expect(rect.h).toBe(1);
  });

  it("contain landscape in portrait letterboxes vertically", () => {
    const rect = visibleImageRect(
      { width: 300, height: 400 },
      { naturalWidth: 800, naturalHeight: 600 },
      "contain",
    );
    expect(rect.y).toBeGreaterThan(0);
    expect(rect.h).toBeLessThan(1);
    expect(rect.x).toBe(0);
    expect(rect.w).toBe(1);
  });
});

describe("projectSlotToImageSpace", () => {
  const container = { width: 400, height: 500 };
  const portraitImage = { naturalWidth: 600, naturalHeight: 800 };

  it("maps top-right slot inside visible image for contain", () => {
    const result = projectSlotToImageSpace(
      { x: 0.7, y: 0.02, w: 0.28, h: 0.2 },
      container,
      portraitImage,
      "contain",
    );
    expect(result.kind).toBe("sample");
    if (result.kind === "sample") {
      expect(result.rect.x).toBeGreaterThanOrEqual(0);
      expect(result.rect.x + result.rect.w).toBeLessThanOrEqual(1.001);
    }
  });

  it("returns opaque when slot is mostly on letterbox", () => {
    const result = projectSlotToImageSpace(
      { x: 0, y: 0, w: 0.02, h: 0.15 },
      container,
      portraitImage,
      "contain",
    );
    expect(result.kind).toBe("opaque");
  });

  it("cover uses identity mapping for full-frame slot", () => {
    const result = projectSlotToImageSpace(
      { x: 0.02, y: 0.72, w: 0.55, h: 0.26 },
      container,
      { naturalWidth: 800, naturalHeight: 600 },
      "cover",
    );
    expect(result.kind).toBe("sample");
    if (result.kind === "sample") {
      expect(result.rect.x).toBeCloseTo(0.02, 2);
      expect(result.rect.y).toBeCloseTo(0.72, 2);
    }
  });
});

describe("serializeRect", () => {
  it("rounds to 4 decimal places", () => {
    expect(serializeRect({ x: 0.123456, y: 0, w: 1, h: 0.5 })).toBe("0.1235,0.0000,1.0000,0.5000");
  });
});

describe("isMaterialRectChange", () => {
  it("detects >= 0.02 delta", () => {
    expect(isMaterialRectChange({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.03, y: 0, w: 1, h: 1 })).toBe(
      true,
    );
    expect(isMaterialRectChange({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.01, y: 0, w: 1, h: 1 })).toBe(
      false,
    );
  });
});
