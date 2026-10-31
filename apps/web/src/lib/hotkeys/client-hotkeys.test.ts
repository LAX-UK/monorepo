import { describe, expect, it } from "vitest";
import { clientGoToShortcuts } from "./client-hotkeys";

describe("clientGoToShortcuts", () => {
  it("offers a g key only for pages in the person's menu, in a fixed order", () => {
    // A consignor's menu: Home, Watching and Consignments; no Bids, Purchases or Team.
    const shortcuts = clientGoToShortcuts([
      { id: "consignments", href: "/selling/consignments" },
      { id: "watchlist", href: "/watching" },
      { id: "home", href: "/home" },
    ]);
    expect(shortcuts.map((s) => [s.keys, s.label, s.href])).toEqual([
      ["g h", "Home", "/home"],
      ["g c", "Consignments", "/selling/consignments"],
    ]);
  });

  it("gives an owner the whole set", () => {
    const pages = ["home", "bids", "purchases", "consignments", "team"].map((id) => ({
      id,
      href: `/${id}`,
    }));
    expect(clientGoToShortcuts(pages).map((s) => s.keys)).toEqual([
      "g h",
      "g b",
      "g p",
      "g c",
      "g t",
    ]);
  });
});
