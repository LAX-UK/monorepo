import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyThemeDom, resolveEffectiveDark } from "./apply-theme-dom";

beforeEach(() => {
  document.documentElement.className = "";
  document.cookie = "";
  localStorage.clear();
});

afterEach(() => {
  document.documentElement.className = "";
  document.cookie = "";
  localStorage.clear();
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
});
