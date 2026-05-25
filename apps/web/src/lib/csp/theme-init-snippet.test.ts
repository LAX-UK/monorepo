import { buildThemeInitSnippet } from "@/lib/csp/build-theme-init-snippet";
import { THEME_INIT_SNIPPET } from "@/lib/csp/theme-init-snippet";
import { resolveIsDarkClass } from "@/lib/preferences/resolve-theme";
import { THEME_COOKIE_NAME, THEME_STORAGE_KEY } from "@/lib/preferences/theme-cookie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
}

function runThemeInitSnippet() {
  // biome-ignore lint/security/noGlobalEval: controlled test harness for inline bootstrap
  eval(THEME_INIT_SNIPPET);
}

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  }
}

describe("THEME_INIT_SNIPPET", () => {
  const memoryLocalStorage = createMemoryLocalStorage();

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryLocalStorage,
    });
    memoryLocalStorage.clear();
    document.documentElement.className = "";
    clearCookies();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    memoryLocalStorage.clear();
    document.documentElement.className = "";
    clearCookies();
  });

  it("matches buildThemeInitSnippet output", () => {
    expect(THEME_INIT_SNIPPET).toBe(buildThemeInitSnippet());
  });

  it.each([
    { cookie: "light", storedTheme: null, prefersDark: true, expected: false },
    { cookie: "dark", storedTheme: null, prefersDark: false, expected: true },
    { cookie: "system", storedTheme: null, prefersDark: true, expected: true },
    { cookie: null, storedTheme: "light", prefersDark: true, expected: false },
    { cookie: null, storedTheme: null, prefersDark: true, expected: true },
    { cookie: null, storedTheme: null, prefersDark: false, expected: false },
  ])(
    "cookie=$cookie storedTheme=$storedTheme prefersDark=$prefersDark → dark=$expected",
    ({ cookie, storedTheme, prefersDark, expected }) => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation(() => ({
          matches: prefersDark,
          media: "(prefers-color-scheme: dark)",
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });

      if (cookie) {
        document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(cookie)}`;
      }
      if (storedTheme) {
        memoryLocalStorage.setItem(THEME_STORAGE_KEY, storedTheme);
      }

      runThemeInitSnippet();

      const storedPreference =
        cookie === "light" || cookie === "dark" || cookie === "system"
          ? cookie
          : storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
            ? storedTheme
            : null;

      expect(document.documentElement.classList.contains("dark")).toBe(expected);
      expect(
        resolveIsDarkClass({
          preference: storedPreference,
          prefersDark,
        }),
      ).toBe(expected);
    },
  );
});
