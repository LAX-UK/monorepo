import { describe, expect, it } from "vitest";
import { publishHeaderVars, topBarShift } from "./header-offset.js";

describe("topBarShift", () => {
  it("follows the scroll up to the top bar's height", () => {
    expect(topBarShift(0, 36)).toBe(0);
    expect(topBarShift(20, 36)).toBe(20);
    expect(topBarShift(500, 36)).toBe(36);
  });

  it("ignores overscroll above the page and a missing top bar", () => {
    expect(topBarShift(-40, 36)).toBe(0);
    expect(topBarShift(200, 0)).toBe(0);
  });
});

describe("publishHeaderVars", () => {
  it("keeps the full height and exposes the visible offset", () => {
    const root = document.createElement("html");
    publishHeaderVars(root, { height: 110, shift: 36 });
    expect(root.style.getPropertyValue("--header-height")).toBe("110px");
    expect(root.style.getPropertyValue("--lax-top-bar-shift")).toBe("36px");
    expect(root.style.getPropertyValue("--header-offset")).toBe("74px");
  });
});
