import { describe, expect, it } from "vitest";
import {
  DESKTOP_PICKER_ESTIMATED_HEIGHT_PX,
  computeDesktopPickerPosition,
} from "./detached-picker-position.js";

const VIEWPORT_HEIGHT = 800;
const PANEL_HEIGHT = DESKTOP_PICKER_ESTIMATED_HEIGHT_PX;

function anchor(overrides: Partial<DOMRect>): Pick<DOMRect, "top" | "bottom" | "left" | "width"> {
  return {
    top: 100,
    bottom: 140,
    left: 16,
    width: 320,
    ...overrides,
  };
}

describe("computeDesktopPickerPosition", () => {
  it("opens below when the anchor is high on the screen", () => {
    const result = computeDesktopPickerPosition({
      anchor: anchor({ top: 80, bottom: 120 }),
      panelHeight: PANEL_HEIGHT,
      viewportHeight: VIEWPORT_HEIGHT,
    });

    expect(result.placement).toBe("below");
    expect(result.top).toBe(124);
    expect(result.bottom).toBeUndefined();
    expect(result.maxHeight).toBeGreaterThan(PANEL_HEIGHT);
  });

  it("flips above when the anchor is low on the screen", () => {
    const result = computeDesktopPickerPosition({
      anchor: anchor({ top: 620, bottom: 660 }),
      panelHeight: PANEL_HEIGHT,
      viewportHeight: VIEWPORT_HEIGHT,
    });

    expect(result.placement).toBe("above");
    expect(result.bottom).toBe(184);
    expect(result.top).toBeUndefined();
    expect(result.maxHeight).toBeGreaterThan(0);
  });

  it("caps maxHeight on a tight viewport while keeping a usable minimum", () => {
    const result = computeDesktopPickerPosition({
      anchor: anchor({ top: 350, bottom: 390 }),
      panelHeight: PANEL_HEIGHT,
      viewportHeight: 500,
    });

    expect(result.maxHeight).toBeGreaterThanOrEqual(120);
    expect(result.maxHeight).toBeLessThan(PANEL_HEIGHT);
  });

  it("prefers below when both sides are tight but below has more room", () => {
    const result = computeDesktopPickerPosition({
      anchor: anchor({ top: 240, bottom: 280 }),
      panelHeight: PANEL_HEIGHT,
      viewportHeight: VIEWPORT_HEIGHT,
    });

    expect(result.placement).toBe("below");
    expect(result.left).toBe(16);
    expect(result.width).toBe(320);
  });
});
