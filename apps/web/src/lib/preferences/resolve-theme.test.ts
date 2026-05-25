import { describe, expect, it } from "vitest";
import { resolveIsDarkClass, secChPrefersDark } from "./resolve-theme";

describe("secChPrefersDark", () => {
  it("returns true only for dark", () => {
    expect(secChPrefersDark("dark")).toBe(true);
    expect(secChPrefersDark("light")).toBe(false);
    expect(secChPrefersDark(null)).toBe(false);
  });
});

describe("resolveIsDarkClass", () => {
  it.each([
    { preference: "light" as const, prefersDark: true, expected: false },
    { preference: "light" as const, prefersDark: false, expected: false },
    { preference: "dark" as const, prefersDark: false, expected: true },
    { preference: "dark" as const, prefersDark: true, expected: true },
    { preference: "system" as const, prefersDark: true, expected: true },
    { preference: "system" as const, prefersDark: false, expected: false },
    { preference: null, prefersDark: true, expected: true },
    { preference: null, prefersDark: false, expected: false },
  ])(
    "preference=$preference prefersDark=$prefersDark → $expected",
    ({ preference, prefersDark, expected }) => {
      expect(resolveIsDarkClass({ preference, prefersDark })).toBe(expected);
    },
  );
});
