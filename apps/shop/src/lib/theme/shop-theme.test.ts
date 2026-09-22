/** @vitest-environment jsdom */
import {
  applyShopTheme,
  parseShopTheme,
  shopThemeIsDark,
  toggleShopTheme,
} from "@/lib/theme/shop-theme";
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
    expect(parseShopTheme("dark")).toBe("dark");
    expect(parseShopTheme("system")).toBeNull();
    expect(shopThemeIsDark(null, true)).toBe(true);
    expect(shopThemeIsDark("light", true)).toBe(false);
    expect(toggleShopTheme(true)).toBe("light");
  });

  it("persists the class, cookie, and localStorage together", () => {
    applyShopTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("lax_theme=dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
