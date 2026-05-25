import { THEME_COOKIE_NAME } from "@/lib/preferences/theme-cookie";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionThemeSync } from "./session-theme-sync";

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

describe("SessionThemeSync", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryLocalStorage,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: () => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    memoryLocalStorage.clear();
    clearCookies();
    document.documentElement.className = "";
  });

  afterEach(() => {
    memoryLocalStorage.clear();
    clearCookies();
    document.documentElement.className = "";
  });

  it("keeps device cookie when profile theme differs", async () => {
    document.cookie = `${THEME_COOKIE_NAME}=dark`;

    render(<SessionThemeSync theme="system" />);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("hydrates from profile when device storage is empty", async () => {
    render(<SessionThemeSync theme="dark" />);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
  });

  it("prefers profile theme over default seed (system) from middleware", async () => {
    document.cookie = `${THEME_COOKIE_NAME}=system`;

    render(<SessionThemeSync theme="dark" />);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
  });

  it("applies default seed when no profile theme available", async () => {
    document.cookie = `${THEME_COOKIE_NAME}=system`;

    render(<SessionThemeSync theme={null} />);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
