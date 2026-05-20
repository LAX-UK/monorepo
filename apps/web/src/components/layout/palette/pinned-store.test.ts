import { describe, expect, it } from "vitest";
import { parsePinnedCookie, serializePinnedCookie, togglePinned } from "./pinned-store";

describe("pinned-store", () => {
  it("toggles pin on and off", () => {
    const pinned = togglePinned([], {
      kind: "sale",
      id: "s1",
      label: "Spring sale",
      href: "/admin/sales/s1",
    });
    expect(pinned).toHaveLength(1);
    const unpinned = togglePinned(pinned, {
      kind: "sale",
      id: "s1",
      label: "Spring sale",
      href: "/admin/sales/s1",
    });
    expect(unpinned).toHaveLength(0);
  });

  it("caps at 12 pins", () => {
    let list = togglePinned([], {
      kind: "lot",
      id: "0",
      label: "0",
      href: "/0",
    });
    for (let i = 1; i <= 14; i += 1) {
      list = togglePinned(list, {
        kind: "lot",
        id: String(i),
        label: String(i),
        href: `/${i}`,
      });
    }
    expect(list).toHaveLength(12);
  });

  it("round-trips cookie serialization", () => {
    const list = togglePinned([], {
      kind: "artist",
      id: "a1",
      label: "Artist",
      href: "/admin/artists/a1",
    });
    const parsed = parsePinnedCookie(serializePinnedCookie(list));
    expect(parsed[0]?.id).toBe("a1");
  });
});
