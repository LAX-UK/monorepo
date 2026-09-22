import { describe, expect, it } from "vitest";
import { computeMegaMenuContentShift } from "./compute-mega-menu-content-shift.js";

describe("computeMegaMenuContentShift", () => {
  it("aligns content with the open trigger", () => {
    expect(
      computeMegaMenuContentShift({
        panelLeft: 0,
        panelWidth: 1440,
        triggerLeft: 420,
        triggerWidth: 80,
        triggerHeight: 24,
        contentWidth: 180,
      }),
    ).toBe(420);
  });

  it("clamps so the panel stays inside the shelf", () => {
    expect(
      computeMegaMenuContentShift({
        panelLeft: 0,
        panelWidth: 400,
        triggerLeft: 360,
        triggerWidth: 80,
        triggerHeight: 24,
        contentWidth: 180,
      }),
    ).toBe(204);
  });

  it("ignores collapsed triggers", () => {
    expect(
      computeMegaMenuContentShift({
        panelLeft: 0,
        panelWidth: 1440,
        triggerLeft: 420,
        triggerWidth: 0,
        triggerHeight: 0,
        contentWidth: 180,
      }),
    ).toBe(0);
  });
});
