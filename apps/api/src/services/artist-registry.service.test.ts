import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { DrizzleArtistRegistryRepository } from "../repositories/drizzle-artist-registry.repository.js";
import { ArtistRegistryService } from "./artist-registry.service.js";
import { ArtistRegistryQueryService } from "./artist-registry/artist-registry-query.service.js";

/** Build a chainable Drizzle-like stub. The shared `then(resolve)` call
 * on the chain returns the next configured row set from `resultsQueue`.
 * * Each call to `.select()` (or `.update()` or `.insert()`) starts a new chain;
 * we record it in `chains` so tests can assert how many round-trips the
 * service made and in what order.
 */
type Chain = {
  /** Records the kebab-case op name (`select` / `update` / etc.) for assertions. */
  op: "select" | "insert" | "update";
  /** Public methods invoked on this chain (for assertion / debugging). */
  calls: string[];
};

function makeFluentDb(resultsQueue: unknown[][]) {
  const chains: Chain[] = [];

  function startChain(op: Chain["op"]) {
    const chain: Chain = { op, calls: [] };
    chains.push(chain);

    const result = resultsQueue.shift() ?? [];

    const handler: ProxyHandler<object> = {
      get(_t, prop: string | symbol) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        }
        if (typeof prop === "string") chain.calls.push(prop);
        return () => proxy;
      },
    };
    const proxy: object = new Proxy({}, handler);
    return proxy as Record<string, unknown>;
  }

  const db = {
    select: () => startChain("select"),
    insert: () => startChain("insert"),
    update: () => startChain("update"),
    transaction: async (fn: (tx: unknown) => unknown) => {
      return await fn({
        select: () => startChain("select"),
        insert: () => startChain("insert"),
        update: () => startChain("update"),
      });
    },
  } as unknown as Database;

  return { db, chains };
}

function registryService(db: Database) {
  return new ArtistRegistryService(new DrizzleArtistRegistryRepository(db));
}

describe("ArtistRegistryService.search (3-pass)", () => {
  it("returns [] for empty query", async () => {
    const { db } = makeFluentDb([]);
    const svc = registryService(db);
    await expect(svc.search("")).resolves.toEqual([]);
    await expect(svc.search("   ")).resolves.toEqual([]);
  });

  it("returns exact hits and short-circuits when the limit is full", async () => {
    const exactRow = {
      id: "a-1",
      displayName: "Picasso",
      slug: "picasso",
      kind: "artist",
      status: "approved",
    };
    // limit=1; one exact row should be returned without alias/fuzzy passes.
    const { db, chains } = makeFluentDb([[exactRow]]);
    const svc = registryService(db);
    const hits = await svc.search("Picasso", 1);
    expect(hits).toEqual([
      {
        id: "a-1",
        displayName: "Picasso",
        slug: "picasso",
        kind: "artist",
        status: "approved",
        matchedAlias: null,
        matchType: "exact",
        score: 1,
      },
    ]);
    // Only one round-trip — pass 2 and 3 were skipped.
    expect(chains).toHaveLength(1);
  });

  it("falls through to alias, partial, and fuzzy passes when exact pass is empty", async () => {
    const aliasRow = {
      id: "a-2",
      displayName: "Pablo Ruiz Picasso",
      slug: "pablo-ruiz-picasso",
      kind: "artist",
      status: "approved",
      alias: "Picasso",
    };
    const fuzzyRow = {
      id: "a-3",
      displayName: "Picazzo",
      slug: "picazzo",
      kind: "artist",
      status: "approved",
      score: 0.7,
    };
    const { db, chains } = makeFluentDb([[], [aliasRow], [], [fuzzyRow]]);
    const svc = registryService(db);
    const hits = await svc.search("Picasso", 5);

    expect(chains).toHaveLength(4); // exact, alias, partial, fuzzy
    expect(hits.map((h) => h.matchType)).toEqual(["alias", "fuzzy"]);
    expect(hits[0]?.matchedAlias).toBe("Picasso");
    expect(hits[1]?.score).toBe(0.7);
  });

  it("returns partial substring matches when the query is not an exact name", async () => {
    const partialRow = {
      id: "b-1",
      displayName: "Rolex SA",
      slug: "rolex-sa",
      kind: "brand",
      status: "approved",
      alias: null,
    };
    const { db, chains } = makeFluentDb([[], [], [partialRow], []]);
    const svc = registryService(db);
    const hits = await svc.search("Role", 5);

    expect(chains).toHaveLength(4);
    expect(hits).toEqual([
      {
        id: "b-1",
        displayName: "Rolex SA",
        slug: "rolex-sa",
        kind: "brand",
        status: "approved",
        matchedAlias: null,
        matchType: "partial",
        score: 0.85,
      },
    ]);
  });

  it("dedupes alias hits that overlap with exact hits", async () => {
    const sharedRow = {
      id: "a-1",
      displayName: "Picasso",
      slug: "picasso",
      kind: "artist",
      status: "approved",
    };
    const aliasRow = { ...sharedRow, alias: "Picasso" };
    const { db } = makeFluentDb([[sharedRow], [aliasRow], [], []]);
    const svc = registryService(db);
    const hits = await svc.search("Picasso", 5);
    expect(hits.map((h) => h.id)).toEqual(["a-1"]);
    expect(hits[0]?.matchType).toBe("exact");
  });
});

describe("ArtistRegistryService.proposeMatches", () => {
  it("buckets search results by matchType and respects limit", async () => {
    const svc = registryService({} as Database);
    vi.spyOn(ArtistRegistryQueryService.prototype, "search").mockResolvedValue([
      {
        id: "1",
        displayName: "A",
        slug: "a",
        kind: "artist",
        status: "approved",
        matchedAlias: null,
        matchType: "exact",
        score: 1,
      },
      {
        id: "2",
        displayName: "B",
        slug: "b",
        kind: "artist",
        status: "approved",
        matchedAlias: "B-alias",
        matchType: "alias",
        score: 1,
      },
      {
        id: "3",
        displayName: "C",
        slug: "c",
        kind: "artist",
        status: "approved",
        matchedAlias: null,
        matchType: "fuzzy",
        score: 0.6,
      },
      {
        id: "4",
        displayName: "D",
        slug: "d",
        kind: "artist",
        status: "approved",
        matchedAlias: null,
        matchType: "fuzzy",
        score: 0.5,
      },
    ]);

    const result = await svc.proposeMatches({ name: "x", limit: 1 });
    expect(result.exact).toHaveLength(1);
    expect(result.alias).toHaveLength(1);
    expect(result.fuzzy).toHaveLength(1);
    expect(result.fuzzy[0]?.id).toBe("3");
  });
});

describe("ArtistRegistryService.merge", () => {
  it("rejects self-merge before any DB work", async () => {
    const { db, chains } = makeFluentDb([]);
    const svc = registryService(db);
    await expect(
      svc.merge("reviewer-1", {
        fromArtistId: "same",
        intoArtistId: "same",
        reason: "test",
      }),
    ).rejects.toThrow("artist_merge_self");
    expect(chains).toHaveLength(0);
  });

  it("performs a full merge transaction in the documented order", async () => {
    const intoRow = {
      id: "into",
      displayName: "Into",
      slug: "into",
      kind: "artist",
      status: "approved",
      mergedIntoArtistId: null,
      shortBio: null,
      nationality: null,
      birthYear: null,
      deathYear: null,
      createdByUserId: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      archived: false,
      verified: false,
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fromRow = { ...intoRow, id: "from", slug: "from", displayName: "From" };
    const updatedFrom = {
      ...fromRow,
      status: "merged_into",
      mergedIntoArtistId: "into",
    };

    // Expected sequence:
    //   1. select Into  -> [intoRow]
    //   2. select From  -> [fromRow]
    //   3. update aliases (re-point) -> [{id:'a1'}]
    //   4. insert merge_history alias -> []
    //   5. update lots (re-point) -> [{id:'l1'},{id:'l2'}]
    //   6. update From (mark merged_into) -> [updatedFrom]
    //   7. insert admin review task -> []
    const { db, chains } = makeFluentDb([
      [fromRow],
      [intoRow],
      [{ id: "a1" }],
      [],
      [{ id: "l1" }, { id: "l2" }],
      [updatedFrom],
      [],
    ]);

    const svc = registryService(db);
    const result = await svc.merge("reviewer-1", {
      fromArtistId: "from",
      intoArtistId: "into",
      reason: "duplicate",
    });

    expect(result.aliasesMoved).toBe(1);
    expect(result.lotsMoved).toBe(2);
    expect(result.merged.id).toBe("from");
    expect(result.merged.status).toBe("merged_into");
    expect(result.remaining.id).toBe("into");

    // Check we did exactly 7 chains and the op order matches.
    expect(chains.map((c) => c.op)).toEqual([
      "select",
      "select",
      "update",
      "insert",
      "update",
      "update",
      "insert",
    ]);
  });
});
