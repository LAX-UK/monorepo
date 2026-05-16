import { resolveLayoutView } from "@/lib/preferences/resolve-layout-view";
import { describe, expect, it } from "vitest";

describe("resolveLayoutView", () => {
  it("prefers URL view", () => {
    expect(
      resolveLayoutView({
        urlView: "list",
        category: "lots",
        uiPreferences: { viewLotsDefault: "grid", viewSync: true },
        cookieRaw: "card",
        fallback: "grid",
      }),
    ).toBe("list");
  });

  it("uses category default when viewSync before cookie", () => {
    expect(
      resolveLayoutView({
        urlView: null,
        category: "lots",
        uiPreferences: { viewLotsDefault: "card", viewSync: true },
        cookieRaw: "list",
        fallback: "grid",
      }),
    ).toBe("card");
  });

  it("uses cookie when viewSync false and default auto", () => {
    expect(
      resolveLayoutView({
        urlView: null,
        category: "lots",
        uiPreferences: { viewLotsDefault: "auto", viewSync: false },
        cookieRaw: "list",
        fallback: "grid",
      }),
    ).toBe("list");
  });

  it("uses user default when cookie missing", () => {
    expect(
      resolveLayoutView({
        urlView: null,
        category: "artists",
        uiPreferences: { viewArtistsDefault: "card", viewSync: false },
        cookieRaw: null,
        fallback: "grid",
      }),
    ).toBe("card");
  });

  it("falls back when nothing applies", () => {
    expect(
      resolveLayoutView({
        urlView: null,
        category: "sales",
        uiPreferences: { viewSalesDefault: "auto" },
        cookieRaw: null,
        fallback: "list",
      }),
    ).toBe("list");
  });
});
