import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterQueueReader, DrizzleArtworkRegisterRepository } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-03T09:00:00.000Z");
const T1 = new Date("2026-11-03T10:00:00.000Z");
const T2 = new Date("2026-11-03T11:00:00.000Z");

function newEntry(n: number, overrides: Partial<NewArtworkRegisterEntry> = {}) {
  return {
    zohoProductId: `50${n}`,
    stockCode: `LAX-ORI-PH-GAC-26-000${n}`,
    kind: "original",
    sourceOriginalId: null,
    title: `Work ${n}`,
    artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: ["img-1"],
    catalogueStatus: "Available",
    zohoModifiedAt: new Date(T0.getTime() + n * 60_000),
    ...overrides,
  } satisfies NewArtworkRegisterEntry;
}

describe.skipIf(!url)("artwork register queues (Postgres)", { timeout: 30_000 }, () => {
  const repo = new DrizzleArtworkRegisterRepository(db);
  const queue = new DrizzleArtworkRegisterQueueReader(db);

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE artwork_register_conflict, artwork_register_event, artwork_register CASCADE`,
    );
  });

  async function add(entry: NewArtworkRegisterEntry) {
    const result = await repo.create(entry, "system", T0);
    if (!result.ok) throw new Error(result.reason);
    return result.entry;
  }

  it("lists held records, newest Zoho edit first, with the total", async () => {
    await add(newEntry(1));
    await add(newEntry(2));
    await add(newEntry(3));
    const first = await queue.listHeld({}, { limit: 2, offset: 0 });
    expect(first.entries.map((e) => e.title)).toEqual(["Work 3", "Work 2"]);
    expect(first.total).toBe(3);
    const second = await queue.listHeld({}, { limit: 2, offset: 2 });
    expect(second.entries.map((e) => e.title)).toEqual(["Work 1"]);
    expect(await queue.countHeld()).toBe(3);
  });

  it("leaves out records that are offered somewhere", async () => {
    const entry = await add(newEntry(1));
    await add(newEntry(2));
    await repo.moveOffer({
      registerId: entry.id,
      expectedVersion: entry.version,
      to: "withdrawn",
      ref: null,
      actor: "staff:u1",
      now: T1,
    });
    expect(
      (await queue.listHeld({}, { limit: 10, offset: 0 })).entries.map((e) => e.title),
    ).toEqual(["Work 2"]);
  });

  it("filters by artist and by what is missing", async () => {
    await add(newEntry(1, { imageRefs: [] }));
    await add(newEntry(2, { dimensions: " " }));
    await add(
      newEntry(3, { medium: null, artist: { zohoArtistId: null, name: "Zed", code: "ZD" } }),
    );
    const titles = async (filter: Parameters<typeof queue.listHeld>[0]) =>
      (await queue.listHeld(filter, { limit: 10, offset: 0 })).entries.map((e) => e.title).sort();
    expect(await titles({ missing: "image" })).toEqual(["Work 1"]);
    expect(await titles({ missing: "size" })).toEqual(["Work 2"]);
    expect(await titles({ missing: "medium" })).toEqual(["Work 3"]);
    expect(await titles({ artistCode: "ZD" })).toEqual(["Work 3"]);
    expect(await titles({ artistCode: "PH", missing: "medium" })).toEqual([]);
  });

  it("lists the artists with held records by name", async () => {
    await add(newEntry(1));
    await add(newEntry(2));
    await add(newEntry(3, { artist: { zohoArtistId: null, name: "Zed", code: "ZD" } }));
    expect(await queue.listHeldArtists()).toEqual([
      { code: "PH", name: "Aidan Phelan", count: 2 },
      { code: "ZD", name: "Zed", count: 1 },
    ]);
  });

  describe("conflicts", () => {
    async function conflicted() {
      const entry = await add(newEntry(1));
      await repo.applyZohoChange(
        { zohoProductId: "501", modifiedAt: T2, fields: { stockCode: "LAX-ORI-PH-GAC-26-0099" } },
        T2,
      );
      return entry;
    }

    it("lists open conflicts with their artwork, and counts them", async () => {
      const entry = await conflicted();
      const page = await queue.listOpenConflicts({}, { limit: 10, offset: 0 });
      expect(page.total).toBe(1);
      expect(page.items[0]?.entry.id).toBe(entry.id);
      expect(page.items[0]?.conflict).toMatchObject({
        field: "stockCode",
        zohoValue: "LAX-ORI-PH-GAC-26-0099",
        status: "open",
      });
      expect(await queue.countOpenConflicts()).toBe(1);
      expect(await queue.listOpenConflicts({ artistCode: "ZD" }, { limit: 10, offset: 0 })).toEqual(
        { items: [], total: 0 },
      );
    });

    it("keeps a resolved conflict on the artwork but out of the queue", async () => {
      const entry = await conflicted();
      const [open] = await queue.listConflictsFor(entry.id);
      await repo.resolveConflict({
        conflictId: open?.id ?? "",
        resolution: "kept_lax",
        resolvedBy: "staff:u1",
        now: T2,
      });
      expect(await queue.countOpenConflicts()).toBe(0);
      expect((await queue.listConflictsFor(entry.id)).map((c) => c.status)).toEqual(["resolved"]);
    });
  });
});
