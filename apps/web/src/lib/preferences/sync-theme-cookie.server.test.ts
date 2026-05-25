import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
  })),
}));

import {
  resolveEffectiveThemePreference,
  resolveThemePreference,
} from "./sync-theme-cookie.server";

describe("resolveThemePreference", () => {
  it("returns cookie when present", () => {
    expect(resolveThemePreference("dark", "system")).toBe("dark");
  });

  it("falls back to session theme when cookie absent", () => {
    expect(resolveThemePreference(undefined, "dark")).toBe("dark");
  });

  it("returns null when both absent", () => {
    expect(resolveThemePreference(undefined, undefined)).toBeNull();
  });
});

describe("resolveEffectiveThemePreference", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
  });

  it("returns cookie when present and does not write cookies", async () => {
    mockGet.mockReturnValue({ value: "dark" });

    await expect(resolveEffectiveThemePreference("system")).resolves.toBe("dark");
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("returns profile theme when cookie absent without writing cookies", async () => {
    mockGet.mockReturnValue(undefined);

    await expect(resolveEffectiveThemePreference("dark")).resolves.toBe("dark");
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("returns null when cookie and profile are absent", async () => {
    mockGet.mockReturnValue(undefined);

    await expect(resolveEffectiveThemePreference(undefined)).resolves.toBeNull();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
