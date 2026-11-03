import { describe, expect, it } from "vitest";
import { assembleDigest } from "./digest.js";
import type { PendingMatch } from "./match.js";
import type { AlertTopic } from "./products.js";

let n = 0;
function match(topic: AlertTopic, title: string, extra: Partial<PendingMatch> = {}): PendingMatch {
  n += 1;
  return {
    id: `m${n}`,
    subscriberId: "s1",
    topic,
    itemKey: `${topic}:${n}`,
    groupKey: null,
    snapshot: { title, path: `/x/${n}` },
    matchedAt: new Date(`2026-11-03T0${n % 9}:00:00Z`),
    ...extra,
  };
}

describe("assembleDigest", () => {
  it("says nothing when nothing matched", () => {
    expect(assembleDigest([])).toBeNull();
  });

  it("names the sale in the subject of a one-sale digest", () => {
    const vm = assembleDigest([match("bid.new_sales", "Modern British and Irish Art")]);
    expect(vm?.subject).toBe("New sale: Modern British and Irish Art");
    expect(vm?.groups).toHaveLength(1);
    expect(vm?.groups[0]?.heading).toBe("New sales");
  });

  it("counts several sales in the subject", () => {
    const vm = assembleDigest([match("bid.new_sales", "A"), match("bid.new_sales", "B")]);
    expect(vm?.subject).toBe("2 new sales on LAX Bid");
  });

  it("leads with a sale and counts the lots after it", () => {
    const vm = assembleDigest([
      match("bid.artists", "Low tide"),
      match("bid.artists", "Estuary"),
      match("bid.searches", "Cafe interior"),
      match("bid.new_sales", "Modern British and Irish Art"),
    ]);
    expect(vm?.subject).toBe("New sale: Modern British and Irish Art, and 3 lots for you");
    expect(vm?.groups.map((g) => g.topic)).toEqual([
      "bid.new_sales",
      "bid.artists",
      "bid.searches",
    ]);
  });

  it("falls back to a neutral word when the rest mixes kinds", () => {
    const vm = assembleDigest([
      match("shop.releases", "Harbour light"),
      match("shop.back_in_stock", "Night ferry"),
    ]);
    expect(vm?.subject).toBe("New edition: Harbour light, and 1 edition for you");
  });

  it("lists at most six items per group and keeps the true total", () => {
    const many = Array.from({ length: 9 }, (_, i) => match("bid.artists", `Lot ${i}`));
    const vm = assembleDigest(many);
    const group = vm?.groups[0];
    expect(group?.total).toBe(9);
    expect(group?.truncated).toBe(true);
    expect(group?.subgroups.flatMap((s) => s.items)).toHaveLength(6);
    expect(vm?.totalItems).toBe(9);
    expect(vm?.subject).toBe("9 new lots by artists you follow");
  });

  it("groups matches by artist or search and shows the criteria", () => {
    const vm = assembleDigest([
      match("bid.artists", "Low tide", {
        groupKey: "artist:1",
        snapshot: {
          title: "Low tide",
          path: "/l/1",
          groupLabel: "Iris Calder",
          groupCriteria: "oil, £2,000 to £20,000",
        },
      }),
      match("bid.artists", "Heron", {
        groupKey: "artist:2",
        snapshot: { title: "Heron", path: "/l/2", groupLabel: "Patrick Heron" },
      }),
    ]);
    const subs = vm?.groups[0]?.subgroups;
    expect(subs?.map((s) => s.label)).toEqual(["Iris Calder", "Patrick Heron"]);
    expect(subs?.[0]?.criteria).toBe("oil, £2,000 to £20,000");
  });
});
