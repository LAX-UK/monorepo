import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository, DrizzleSoldAttentionStore } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-03T09:00:00.000Z");
const T1 = new Date("2026-11-03T10:00:00.000Z");
const T2 = new Date("2026-11-03T11:00:00.000Z");

function newEntry(n: number): NewArtworkRegisterEntry {
  return {
    zohoProductId: `sa-${n}`,
    stockCode: `LAX-ORI-PH-GAC-26-${String(n).padStart(4, "0")}`,
    kind: "original",
    sourceOriginalId: null,
    title: `Work ${n}`,
    artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus: "Available",
  };
}

describe.skipIf(!url)("sold attention store (Postgres)", { timeout: 30_000 }, () => {
  const register = new DrizzleArtworkRegisterRepository(db);
  const store = new DrizzleSoldAttentionStore(db);

  // Items reference the register (ON DELETE RESTRICT): leave none behind for the other register tests.
  afterAll(async () => {
    await db.execute(sql`DELETE FROM artwork_register_sold_attention`);
  });

  beforeEach(async () => {
    await db.execute(
      sql`UPDATE lot SET artwork_register_id = NULL WHERE artwork_register_id IS NOT NULL`,
    );
    await db.execute(
      sql`TRUNCATE artwork_register_sold_attention, artwork_register_conflict, artwork_register_event`,
    );
    await db.execute(sql`UPDATE artwork_register SET source_original_id = NULL`);
    await db.execute(sql`DELETE FROM artwork_register`);
  });

  async function entry(n: number) {
    const result = await register.create(newEntry(n), "system", T0);
    if (!result.ok) throw new Error(result.reason);
    return result.entry;
  }

  const raiseInput = (
    e: { id: string; zohoProductId: string },
    status: "Sold" | "Reserved",
    now: Date,
  ) => ({
    registerId: e.id,
    zohoProductId: e.zohoProductId,
    zohoStatus: status,
    place: "lax_art" as const,
    placeRefId: null,
    markedAt: T0,
    now,
  });

  it("replaces one item with another in one step, so something is always open", async () => {
    const e = await entry(1);
    await store.raise(raiseInput(e, "Sold", T1));
    const live = await store.findLive(e.id);
    expect(
      await store.replace({ id: live?.id ?? "", now: T2, raise: raiseInput(e, "Reserved", T2) }),
    ).toBe(true);
    expect(await store.isPaused({ registerId: e.id })).toBe(true);
    expect((await store.findLive(e.id))?.zohoStatus).toBe("Reserved");
  });

  it("answers with the newest live item when two are live", async () => {
    const e = await entry(3);
    await store.raise(raiseInput(e, "Sold", T1));
    await store.raise(raiseInput(e, "Reserved", T2));
    expect((await store.findLive(e.id))?.zohoStatus).toBe("Reserved");
  });

  it("pages through live items with a cursor, including items raised at the same moment", async () => {
    const entries = [];
    for (let n = 10; n < 15; n += 1) entries.push(await entry(n));
    for (const e of entries) await store.raise(raiseInput(e, "Sold", T1));
    const seen: string[] = [];
    let after: { raisedAt: Date; id: string } | undefined;
    for (;;) {
      const page = await store.listLive(2, after);
      seen.push(...page.map((i) => i.registerId));
      const last = page.at(-1);
      if (!last || page.length < 2) break;
      after = { raisedAt: last.raisedAt, id: last.id };
    }
    expect(seen.sort()).toEqual(entries.map((e) => e.id).sort());
  });

  it("records an item closed because the artwork sold in LAX", async () => {
    const e = await entry(20);
    await store.raise(raiseInput(e, "Sold", T1));
    const live = await store.findLive(e.id);
    expect(await store.resolve({ id: live?.id ?? "", resolution: "sold_in_lax", now: T2 })).toBe(
      true,
    );
    expect(await store.findLive(e.id)).toBeNull();
  });
});
