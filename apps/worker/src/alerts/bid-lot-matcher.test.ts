import type { NewMatch } from "@auction/alerts";
import { matchSnapshotSchema } from "@auction/alerts";
import type { AlertableLot, ArtistWatcher, SearchWatcher } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { BidLotMatcher } from "./bid-lot-matcher.js";
import { artistCriteriaLine, lotPriceLine } from "./lot-snapshot.js";

const NOW = new Date("2026-11-03T10:00:00Z");

const lot = (over: Partial<AlertableLot> = {}): AlertableLot => ({
  id: "lot-1",
  title: "Low tide",
  medium: "Oil on canvas",
  artistId: "artist-1",
  artistName: "Iris Calder",
  saleTitle: "Modern British",
  price: "5000.00",
  estimate: { low: "5000.00", high: "8000.00", currency: "GBP" },
  startingPrice: "3000.00",
  saleAnnounced: true,
  ...over,
});

const criteria = (over: Partial<ArtistWatcher["criteria"]> = {}) => ({
  medium: null,
  priceMin: null,
  priceMax: null,
  ...over,
});

function setup(input: {
  lots: AlertableLot[];
  artists?: ArtistWatcher[];
  searches?: SearchWatcher[];
  /** Lot ids each search text finds. */
  finds?: Record<string, string[]>;
}) {
  const record = vi.fn(async (matches: readonly NewMatch[]) => matches.length);
  const provisioner = { ensureArtistFollowers: vi.fn(), ensureSearchers: vi.fn() };
  const matchingSearch = vi.fn(
    async (query: SearchWatcher["query"]) => new Set(input.finds?.[query.q] ?? []),
  );
  const matcher = new BidLotMatcher({
    lots: { findAlertable: async () => input.lots, matchingSearch },
    watchers: {
      artistWatchers: async () => input.artists ?? [],
      alertingSearches: async () => input.searches ?? [],
    },
    provisioner,
    matches: { record },
    clock: { now: () => NOW },
  });
  const recorded = () => record.mock.calls.flatMap((c) => c[0]);
  return { matcher, record, recorded, provisioner, matchingSearch };
}

const event = (lotId: string) => ({ lotId });
const search = (over: Partial<SearchWatcher> = {}): SearchWatcher => ({
  subscriberId: "sub-1",
  searchId: "search-1",
  label: "Search: tide",
  query: { q: "tide", categoryId: null },
  ...over,
});

describe("BidLotMatcher: followed artists", () => {
  it("matches a lot by a followed artist with no criteria", async () => {
    const t = setup({
      lots: [lot()],
      artists: [{ subscriberId: "sub-1", artistId: "artist-1", criteria: criteria() }],
    });
    const out = await t.matcher.handle([event("lot-1")]);
    expect(out).toEqual({ lots: 1, artistMatches: 1, searchMatches: 0 });
    const [match] = t.recorded();
    expect(match).toMatchObject({
      subscriberId: "sub-1",
      topic: "bid.artists",
      itemKey: "lot:lot-1",
      groupKey: "artist-1",
      matchedAt: NOW,
    });
    expect(match?.snapshot).toMatchObject({
      title: "Low tide",
      groupLabel: "Iris Calder",
      groupCriteria: "Every new lot",
      detail: "Estimate £5,000 to £8,000",
    });
    expect(match?.snapshot.path).toBe("/lot/low-tide/lot-1");
    expect(() => matchSnapshotSchema.parse(match?.snapshot)).not.toThrow();
  });

  it("applies the medium and price criteria", async () => {
    const watcher = (subscriberId: string, c: ArtistWatcher["criteria"]): ArtistWatcher => ({
      subscriberId,
      artistId: "artist-1",
      criteria: c,
    });
    const t = setup({
      lots: [lot()],
      artists: [
        watcher("oil", criteria({ medium: "oil" })),
        watcher("watercolour", criteria({ medium: "watercolour" })),
        watcher("in-range", criteria({ priceMin: "2000", priceMax: "20000" })),
        watcher("too-dear", criteria({ priceMin: "6000" })),
        watcher("too-cheap", criteria({ priceMax: "4999.99" })),
      ],
    });
    await t.matcher.handle([event("lot-1")]);
    expect(t.recorded().map((m) => m.subscriberId)).toEqual(["oil", "in-range"]);
  });

  it("compares the start price when the lot has no estimate", async () => {
    const t = setup({
      lots: [lot({ estimate: null, price: "3000.00" })],
      artists: [
        { subscriberId: "a", artistId: "artist-1", criteria: criteria({ priceMax: "3500" }) },
        { subscriberId: "b", artistId: "artist-1", criteria: criteria({ priceMin: "3500" }) },
      ],
    });
    await t.matcher.handle([event("lot-1")]);
    expect(t.recorded().map((m) => m.subscriberId)).toEqual(["a"]);
    expect(t.recorded()[0]?.snapshot.detail).toBe("Starting at £3,000");
  });

  it("ignores lots with no artist and artists nobody follows", async () => {
    const t = setup({ lots: [lot({ artistId: null, artistName: null })] });
    await t.matcher.handle([event("lot-1")]);
    expect(t.provisioner.ensureArtistFollowers).not.toHaveBeenCalled();
    expect(t.recorded()).toEqual([]);
  });

  it("does nothing for lots that are not publicly on sale", async () => {
    const t = setup({ lots: [] });
    expect(await t.matcher.handle([event("gone")])).toEqual({
      lots: 0,
      artistMatches: 0,
      searchMatches: 0,
    });
    expect(t.record).not.toHaveBeenCalled();
  });
});

describe("BidLotMatcher: saved searches", () => {
  it("matches the lots the search finds, grouped by the search", async () => {
    const t = setup({
      lots: [lot(), lot({ id: "lot-2", title: "Other", artistId: null })],
      searches: [search()],
      finds: { tide: ["lot-1"] },
    });
    const out = await t.matcher.handle([event("lot-1"), event("lot-2")]);
    expect(out.searchMatches).toBe(1);
    expect(t.recorded()[0]).toMatchObject({
      topic: "bid.searches",
      itemKey: "lot:lot-1",
      groupKey: "search-1",
    });
    expect(t.recorded()[0]?.snapshot.groupLabel).toBe("Search: tide");
  });

  it("runs one query per distinct search, however many people saved it", async () => {
    const t = setup({
      lots: [lot()],
      searches: [
        search({ subscriberId: "a", searchId: "s1" }),
        search({ subscriberId: "b", searchId: "s2", query: { q: " Tide ", categoryId: null } }),
        search({ subscriberId: "c", searchId: "s3", query: { q: "tide", categoryId: "cat" } }),
      ],
      finds: { tide: ["lot-1"], " Tide ": ["lot-1"] },
    });
    await t.matcher.handle([event("lot-1")]);
    expect(t.matchingSearch).toHaveBeenCalledTimes(2);
    expect(t.recorded().map((m) => m.subscriberId)).toEqual(["a", "b", "c"]);
  });

  it("records a lot once for a person with two matching searches", async () => {
    const t = setup({
      lots: [lot({ artistId: null })],
      searches: [
        search({ searchId: "s1" }),
        search({ searchId: "s2", query: { q: "tide", categoryId: "cat" } }),
      ],
      finds: { tide: ["lot-1"] },
    });
    await t.matcher.handle([event("lot-1")]);
    expect(t.recorded()).toHaveLength(1);
    expect(t.recorded()[0]?.groupKey).toBe("s1");
  });

  it("keeps the artist match when the same person's search finds the lot too", async () => {
    const t = setup({
      lots: [lot()],
      artists: [{ subscriberId: "sub-1", artistId: "artist-1", criteria: criteria() }],
      searches: [search(), search({ subscriberId: "sub-2", searchId: "s2" })],
      finds: { tide: ["lot-1"] },
    });
    const out = await t.matcher.handle([event("lot-1")]);
    expect(out).toEqual({ lots: 1, artistMatches: 1, searchMatches: 1 });
    expect(t.recorded().map((m) => [m.subscriberId, m.topic])).toEqual([
      ["sub-1", "bid.artists"],
      ["sub-2", "bid.searches"],
    ]);
  });

  it("does not look for searches' lots outside the published batch", async () => {
    const t = setup({ lots: [lot()], searches: [search()], finds: { tide: ["lot-9"] } });
    await t.matcher.handle([event("lot-1")]);
    expect(t.recorded()).toEqual([]);
  });
});

describe("snapshot copy", () => {
  it("describes the criteria the person set", () => {
    expect(artistCriteriaLine(criteria())).toBe("Every new lot");
    expect(artistCriteriaLine(criteria({ medium: " Oil " }))).toBe("Oil");
    expect(
      artistCriteriaLine(criteria({ medium: "Oil", priceMin: "2000", priceMax: "20000" })),
    ).toBe("Oil · £2,000 to £20,000");
    expect(artistCriteriaLine(criteria({ priceMin: "2000" }))).toBe("from £2,000");
    expect(artistCriteriaLine(criteria({ priceMax: "500.50" }))).toBe("up to £500.50");
  });

  it("shows the estimate, else the start price", () => {
    expect(lotPriceLine(lot())).toBe("Estimate £5,000 to £8,000");
    expect(lotPriceLine(lot({ estimate: null }))).toBe("Starting at £3,000");
  });
});

describe("BidLotMatcher: sales that are not announced", () => {
  const follower = [{ subscriberId: "sub-1", artistId: "artist-1", criteria: criteria() }];

  it("matches lots of an announced sale", async () => {
    const t = setup({ lots: [lot({ saleAnnounced: true })], artists: follower });
    expect((await t.matcher.handle([event("lot-1")])).artistMatches).toBe(1);
  });

  it("records nothing for a sale staff chose not to announce, for artists or searches", async () => {
    const t = setup({
      lots: [lot({ saleAnnounced: false })],
      artists: follower,
      searches: [search()],
      finds: { tide: ["lot-1"] },
    });
    expect(await t.matcher.handle([event("lot-1")])).toEqual({
      lots: 0,
      artistMatches: 0,
      searchMatches: 0,
    });
    expect(t.record).not.toHaveBeenCalled();
    expect(t.matchingSearch).not.toHaveBeenCalled();
  });

  it("matches only the announced lots of a mixed batch", async () => {
    const t = setup({
      lots: [
        lot({ id: "lot-1", saleAnnounced: true }),
        lot({ id: "lot-2", saleAnnounced: false }),
        lot({ id: "lot-3", saleAnnounced: true }),
      ],
      artists: follower,
    });
    const out = await t.matcher.handle([event("lot-1"), event("lot-2"), event("lot-3")]);
    expect(out).toMatchObject({ lots: 2, artistMatches: 2 });
    expect(t.recorded().map((m) => m.itemKey)).toEqual(["lot:lot-1", "lot:lot-3"]);
  });
});
