import { describe, expect, it } from "vitest";
import { otherTheme, resolveHostedTheme, themeToggleState } from "./theme.js";

describe("resolveHostedTheme", () => {
  it.each([
    ["dark", false, "dark"],
    ["light", true, "light"],
    [null, true, "dark"],
    [null, false, "light"],
    ["sepia", true, "dark"],
  ] as const)("saved %s with a dark system %s is %s", (saved, systemDark, theme) => {
    expect(resolveHostedTheme(saved, systemDark)).toBe(theme);
  });
});

describe("theme toggle", () => {
  const labels = { toDark: "Switch to dark theme", toLight: "Switch to light theme" };

  it("offers the other theme and reports dark as pressed", () => {
    expect(themeToggleState("light", labels)).toEqual({
      label: "Switch to dark theme",
      pressed: "false",
    });
    expect(themeToggleState("dark", labels)).toEqual({
      label: "Switch to light theme",
      pressed: "true",
    });
    expect(otherTheme("dark")).toBe("light");
  });
});
