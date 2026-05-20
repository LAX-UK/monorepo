import { describe, expect, it } from "vitest";
import { parseRecentsCookie, pushRecent, serializeRecentsCookie } from "./recents-store";

describe("recents-store", () => {
  it("dedupes and keeps newest first", () => {
    const first = pushRecent([], {
      kind: "lot",
      id: "a",
      label: "Lot A",
      href: "/admin/lots/a",
    });
    const second = pushRecent(first, {
      kind: "sale",
      id: "b",
      label: "Sale B",
      href: "/admin/sales/b",
    });
    const third = pushRecent(second, {
      kind: "lot",
      id: "a",
      label: "Lot A updated",
      href: "/admin/lots/a",
    });
    expect(third[0]?.label).toBe("Lot A updated");
    expect(third.filter((r) => r.id === "a")).toHaveLength(1);
    expect(third).toHaveLength(2);
  });

  it("caps at 8 entries", () => {
    let list = pushRecent([], {
      kind: "lot",
      id: "0",
      label: "0",
      href: "/0",
    });
    for (let i = 1; i <= 10; i += 1) {
      list = pushRecent(list, {
        kind: "lot",
        id: String(i),
        label: String(i),
        href: `/${i}`,
      });
    }
    expect(list).toHaveLength(8);
  });

  it("round-trips cookie serialization", () => {
    const list = pushRecent([], {
      kind: "client",
      id: "c1",
      label: "Client",
      href: "/admin/clients/c1",
      viewedAt: "2026-05-19T12:00:00.000Z",
    });
    const raw = serializeRecentsCookie(list);
    const parsed = parseRecentsCookie(raw);
    expect(parsed[0]?.id).toBe("c1");
  });
});
