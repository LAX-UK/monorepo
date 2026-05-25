import { THEME_PREFERENCE_CHANGE_EVENT } from "@/lib/preferences/apply-theme-dom";
import { THEME_STORAGE_KEY } from "@/lib/preferences/theme-cookie";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSystemListener } from "./theme-system-listener";

const { applySystemThemeDomMock } = vi.hoisted(() => ({
  applySystemThemeDomMock: vi.fn(),
}));

vi.mock("@/lib/preferences/apply-theme-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/preferences/apply-theme-dom")>();
  return {
    ...actual,
    applySystemThemeDom: applySystemThemeDomMock,
  };
});

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

describe("ThemeSystemListener", () => {
  beforeEach(() => {
    applySystemThemeDomMock.mockClear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryLocalStorage,
    });
    memoryLocalStorage.clear();
  });

  afterEach(() => {
    memoryLocalStorage.clear();
  });

  it("re-syncs when lax:theme-preference-change fires with system preference", () => {
    memoryLocalStorage.setItem(THEME_STORAGE_KEY, "system");
    render(<ThemeSystemListener />);
    applySystemThemeDomMock.mockClear();

    window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_CHANGE_EVENT));

    expect(applySystemThemeDomMock).toHaveBeenCalledTimes(1);
  });

  it("does not apply system theme when preference is not system", () => {
    memoryLocalStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSystemListener />);
    applySystemThemeDomMock.mockClear();

    window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_CHANGE_EVENT));

    expect(applySystemThemeDomMock).not.toHaveBeenCalled();
  });
});
