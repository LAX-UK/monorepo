import { DEFAULT_THEME_PREFERENCE } from "@auction/validators";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readStoredThemePreference } from "./read-stored-theme-preference";
import { THEME_COOKIE_NAME, THEME_STORAGE_KEY, readThemeCookieFromDocument } from "./theme-cookie";

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  }
}

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

describe("readThemeCookieFromDocument", () => {
  beforeEach(() => {
    clearCookies();
  });

  afterEach(() => {
    clearCookies();
  });

  it("reads valid theme cookie values", () => {
    document.cookie = `${THEME_COOKIE_NAME}=dark`;
    expect(readThemeCookieFromDocument()).toBe("dark");
  });

  it("returns null for unknown cookie values", () => {
    document.cookie = `${THEME_COOKIE_NAME}=invalid`;
    expect(readThemeCookieFromDocument()).toBeNull();
  });
});

describe("readStoredThemePreference", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryLocalStorage,
    });
    memoryLocalStorage.clear();
    clearCookies();
  });

  afterEach(() => {
    memoryLocalStorage.clear();
    clearCookies();
  });

  it("prefers cookie over localStorage", () => {
    document.cookie = `${THEME_COOKIE_NAME}=dark`;
    memoryLocalStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredThemePreference()).toBe("dark");
  });

  it("falls back to localStorage when cookie is absent", () => {
    memoryLocalStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredThemePreference()).toBe("light");
  });

  it("returns null when unset", () => {
    expect(readStoredThemePreference()).toBeNull();
  });
});

describe("DEFAULT_THEME_PREFERENCE", () => {
  it("is system", () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe("system");
  });
});
