import type { DigestGroup, DigestItem, DigestVm } from "@auction/alerts";
import { describe, expect, it, vi } from "vitest";
import { BidDigestNotices } from "./bid-digest-notices.js";
import { lotNoticesOf } from "./lot-notices.js";

const item = (
  title: string,
  path = `/lot/${title.toLowerCase().replace(/ /g, "-")}/1`,
): DigestItem => ({
  title,
  subtitle: "Oil on canvas",
  detail: null,
  imageUrl: null,
  path,
});

function group(
  topic: DigestGroup["topic"],
  subs: { label: string; path?: string; items: DigestItem[] }[],
  total?: number,
  truncated = false,
): DigestGroup {
  return {
    topic,
    heading: topic,
    subgroups: subs.map((s) => ({
      label: s.label,
      path: s.path ?? null,
      criteria: null,
      items: s.items,
    })),
    total: total ?? subs.reduce((n, s) => n + s.items.length, 0),
    truncated,
  };
}

const vmOf = (...groups: DigestGroup[]): DigestVm => ({
  subject: "x",
  groups,
  totalItems: groups.reduce((n, g) => n + g.total, 0),
});

describe("lotNoticesOf", () => {
  it("opens the lot for a single match from a followed artist", () => {
    const [notice, ...rest] = lotNoticesOf(
      vmOf(group("bid.artists", [{ label: "Iris Calder", items: [item("Chrome Horizon")] }])),
    );
    expect(rest).toHaveLength(0);
    expect(notice).toEqual({
      type: "artist_lots_listed",
      title: "New lot by Iris Calder",
      message: "Chrome Horizon · Oil on canvas",
      linkPath: "/lot/chrome-horizon/1",
    });
  });

  it("groups a day's lots by one artist into one notice that opens the artist's page", () => {
    const [notice] = lotNoticesOf(
      vmOf(
        group("bid.artists", [
          {
            label: "Iris Calder",
            path: "/artist/iris-calder/a1",
            items: [item("Chrome Horizon"), item("Salt Flat"), item("Low Tide")],
          },
        ]),
      ),
    );
    expect(notice).toMatchObject({
      title: "3 new lots by Iris Calder",
      message: "Including Chrome Horizon",
      linkPath: "/artist/iris-calder/a1",
    });
  });

  it("sends several artists to Watching and names two of them", () => {
    const [notice] = lotNoticesOf(
      vmOf(
        group("bid.artists", [
          { label: "Iris Calder", path: "/artist/iris-calder/a1", items: [item("A"), item("B")] },
          { label: "Tom Hale", path: "/artist/tom-hale/a2", items: [item("C")] },
          { label: "Ana Ruiz", path: "/artist/ana-ruiz/a3", items: [item("D")] },
        ]),
      ),
    );
    expect(notice).toMatchObject({
      title: "4 new lots by artists you follow",
      message: "From Iris Calder, Tom Hale and 1 more",
      linkPath: "/watching",
    });
  });

  it("does not trust one shown group when more matches were cut off", () => {
    const [notice] = lotNoticesOf(
      vmOf(
        group(
          "bid.artists",
          [{ label: "Iris Calder", path: "/artist/iris-calder/a1", items: [item("A"), item("B")] }],
          9,
          true,
        ),
      ),
    );
    expect(notice?.linkPath).toBe("/watching");
    expect(notice?.title).toBe("9 new lots by artists you follow");
  });

  it("writes a separate notice for a saved search, opening its results", () => {
    const notices = lotNoticesOf(
      vmOf(
        group("bid.artists", [{ label: "Iris Calder", items: [item("A")] }]),
        group("bid.searches", [
          { label: "Bronze", path: "/search?q=bronze", items: [item("Head"), item("Torso")] },
        ]),
      ),
    );
    expect(notices.map((n) => n.type)).toEqual(["artist_lots_listed", "search_lots_listed"]);
    expect(notices[1]).toMatchObject({
      title: "2 new lots matching “Bronze”",
      linkPath: "/search?q=bronze",
    });
  });

  it("leaves new-sale groups to the sale notice and writes nothing for an empty digest", () => {
    expect(
      lotNoticesOf(vmOf(group("bid.new_sales", [{ label: "Sale", items: [item("Sale")] }]))),
    ).toEqual([]);
    expect(lotNoticesOf(vmOf())).toEqual([]);
  });

  it("carries no address or detail beyond the person's own lots", () => {
    for (const n of lotNoticesOf(
      vmOf(group("bid.artists", [{ label: "Iris Calder", items: [item("A")] }])),
    )) {
      expect(n.linkPath.startsWith("/")).toBe(true);
      expect(`${n.title} ${n.message}`).not.toMatch(/@|https?:/);
    }
  });
});

describe("BidDigestNotices", () => {
  const input = (vm: DigestVm) => ({
    digestId: "d1",
    subjectId: "u1",
    localDate: "2026-11-03",
    vm,
  });

  it("writes the digest's notices for the account under the digest id", async () => {
    const write = vi.fn(async () => 1);
    await new BidDigestNotices({ notices: { write } }).write(
      input(vmOf(group("bid.artists", [{ label: "Iris Calder", items: [item("A")] }]))),
    );
    expect(write).toHaveBeenCalledWith({
      digestId: "d1",
      userId: "u1",
      notices: [expect.objectContaining({ type: "artist_lots_listed" })],
    });
  });

  it("does not call the store when the digest has nothing to tell in the app", async () => {
    const write = vi.fn(async () => 0);
    await new BidDigestNotices({ notices: { write } }).write(
      input(vmOf(group("bid.new_sales", [{ label: "Sale", items: [item("Sale")] }]))),
    );
    expect(write).not.toHaveBeenCalled();
  });
});
