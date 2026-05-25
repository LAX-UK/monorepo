import { describe, expect, it } from "vitest";
import { isSsrDarkClass } from "./ssr-theme-dark";

describe("isSsrDarkClass", () => {
  it.each([
    { theme: "light" as const, secCh: "dark", expected: false },
    { theme: "dark" as const, secCh: "light", expected: true },
    { theme: "system" as const, secCh: "dark", expected: true },
    { theme: "system" as const, secCh: "light", expected: false },
    { theme: null, secCh: "dark", expected: true },
    { theme: null, secCh: null, expected: false },
  ])("theme=$theme secCh=$secCh → $expected", ({ theme, secCh, expected }) => {
    expect(isSsrDarkClass(theme, secCh)).toBe(expected);
  });
});
