/** @vitest-environment jsdom */
import {
  applyArtTheme,
  artThemeIsDark,
  parseArtTheme,
  toggleArtTheme,
} from "@/lib/theme/art-theme";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("shop theme", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    document.cookie = "lax_theme=;path=/;max-age=0";
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("parses stored preferences and falls back to system when unset", () => {
    expect(parseArtTheme("dark")).toBe("dark");
    expect(parseArtTheme("system")).toBeNull();
    expect(artThemeIsDark(null, true)).toBe(true);
    expect(artThemeIsDark("light", true)).toBe(false);
    expect(toggleArtTheme(true)).toBe("light");
  });

  it("persists the class, cookie, and localStorage together", () => {
    applyArtTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("lax_theme=dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
