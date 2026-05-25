import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applySystemThemeDom, applyThemeDom, resolveEffectiveDark } from "./apply-theme-dom";

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

const memoryLocalStorage = createMemoryLocalStorage();

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  }
}

beforeAll(() => {
  vi.stubGlobal("localStorage", memoryLocalStorage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  memoryLocalStorage.clear();
  document.documentElement.className = "";
  clearCookies();
});

afterEach(() => {
  memoryLocalStorage.clear();
  document.documentElement.className = "";
  clearCookies();
});

describe("applyThemeDom", () => {
  it("sets dark class and storage for dark", () => {
    applyThemeDom("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.cookie).toContain("lax_theme=dark");
  });

  it("clears dark class for light", () => {
    document.documentElement.classList.add("dark");
    applyThemeDom("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});

describe("resolveEffectiveDark", () => {
  it("returns true only for dark mode", () => {
    expect(resolveEffectiveDark("dark")).toBe(true);
    expect(resolveEffectiveDark("light")).toBe(false);
  });

  it("follows OS preference for system mode", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    expect(resolveEffectiveDark("system")).toBe(true);
  });
});

describe("applySystemThemeDom", () => {
  it("updates dark class from OS without writing storage", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    applySystemThemeDom();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBeNull();
    expect(document.cookie).not.toContain("lax_theme=");
  });
});
