import { DEFAULT_THEME_PREFERENCE } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  resolveSessionThemeSyncProp,
  shouldFetchSessionForTheme,
} from "./resolve-root-theme.server";

describe("shouldFetchSessionForTheme", () => {
  it("returns false when theme cookie exists", () => {
    expect(shouldFetchSessionForTheme(true, "dark")).toBe(false);
    expect(shouldFetchSessionForTheme(false, "light")).toBe(false);
  });

  it("returns true only when session cookie exists and theme cookie is absent", () => {
    expect(shouldFetchSessionForTheme(true, null)).toBe(true);
    expect(shouldFetchSessionForTheme(false, null)).toBe(false);
  });
});

describe("resolveSessionThemeSyncProp", () => {
  it("returns null when device theme cookie exists", () => {
    expect(
      resolveSessionThemeSyncProp({
        user: { uiPreferences: { theme: "system" } },
        existingTheme: "dark",
        defaultTheme: DEFAULT_THEME_PREFERENCE,
      }),
    ).toBeNull();
  });

  it("returns profile theme when signed in without device cookie", () => {
    expect(
      resolveSessionThemeSyncProp({
        user: { uiPreferences: { theme: "dark" } },
        existingTheme: null,
        defaultTheme: DEFAULT_THEME_PREFERENCE,
      }),
    ).toBe("dark");
  });

  it("falls back to default when profile theme is absent", () => {
    expect(
      resolveSessionThemeSyncProp({
        user: { uiPreferences: null },
        existingTheme: null,
        defaultTheme: DEFAULT_THEME_PREFERENCE,
      }),
    ).toBe(DEFAULT_THEME_PREFERENCE);
  });
});
