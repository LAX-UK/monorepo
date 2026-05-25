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

import { resolveEffectiveThemePreference } from "./sync-theme-cookie.server";
import { THEME_COOKIE_NAME } from "./theme-cookie";

describe("resolveEffectiveThemePreference", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
  });

  it("returns cookie when present and does not overwrite", async () => {
    mockGet.mockReturnValue({ value: "dark" });

    await expect(resolveEffectiveThemePreference("system")).resolves.toBe("dark");
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("seeds cookie from profile when absent", async () => {
    mockGet.mockReturnValue(undefined);

    await expect(resolveEffectiveThemePreference("dark")).resolves.toBe("dark");
    expect(mockSet).toHaveBeenCalledWith(THEME_COOKIE_NAME, "dark", {
      path: "/",
      maxAge: expect.any(Number),
      sameSite: "lax",
    });
  });

  it("returns null when cookie and profile are absent", async () => {
    mockGet.mockReturnValue(undefined);

    await expect(resolveEffectiveThemePreference(undefined)).resolves.toBeNull();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
