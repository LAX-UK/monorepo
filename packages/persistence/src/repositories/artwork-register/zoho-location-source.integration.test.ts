import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleStockLocationStore,
  DrizzleZohoLocationSourceReader,
} from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-18T09:00:00.000Z");
const T1 = new Date("2026-11-18T10:00:00.000Z");
const T2 = new Date("2026-11-18T11:00:00.000Z");
const STAFF = "staff:s1";

function newEntry(n: number, kind: "original" | "print" = "original"): NewArtworkRegisterEntry {
  return {
    zohoProductId: `zloc-${n}`,
    stockCode: `LAX-ORI-PH-GAC-26-${String(n).padStart(4, "0")}`,
    kind,
    sourceOriginalId: null,
    title: `Work ${n}`,
    artist: { zohoArtistId: "77", name: "Test Artist", code: "PH" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus: "Available",
  };
}

describe.skipIf(!url)("Zoho LAX_Location sources (Postgres)", { timeout: 30_000 }, () => {
  const register = new DrizzleArtworkRegisterRepository(db);
  const store = new DrizzleStockLocationStore(db);
  const reader = new DrizzleZohoLocationSourceReader(db);

  async function clear() {
    await db.execute(
      sql`ALTER TABLE artwork_location_move DISABLE TRIGGER artwork_location_move_append_only`,
    );
    await db.execute(sql`DELETE FROM artwork_location_move`);
    await db.execute(
      sql`ALTER TABLE artwork_location_move ENABLE TRIGGER artwork_location_move_append_only`,
    );
    await db.execute(sql`DELETE FROM artwork_location`);
    await db.execute(
      sql`DELETE FROM domain_events WHERE event_type = 'artwork_register.location_changed'`,
    );
  }

  afterAll(clear);

  beforeEach(async () => {
    await clear();
    await db.execute(
      sql`UPDATE lot SET artwork_register_id = NULL WHERE artwork_register_id IS NOT NULL`,
    );
    await db.execute(
      sql`TRUNCATE artwork_register_sold_attention, artwork_register_conflict, artwork_register_event`,
    );
    await db.execute(sql`UPDATE artwork_register SET source_original_id = NULL`);
    await db.execute(sql`DELETE FROM artwork_register`);
  });

  async function artwork(n: number) {
    const result = await register.create(newEntry(n), "zoho", T0);
    if (!result.ok) throw new Error(result.reason);
    return result.entry;
  }

  async function add(name: string) {
    const result = await store.addLocation({ name, note: null, actor: STAFF, now: T0 });
    if (!result.ok) throw new Error(result.reason);
    return result.location;
  }

  async function move(registerId: string, locationId: string, now: Date) {
    const result = await store.moveArtworks({
      registerIds: [registerId],
      locationId,
      note: null,
      actor: STAFF,
      now,
    });
    if (!result.ok) throw new Error(result.reason);
  }

  it("reads each original's Product and its latest location, and null where none is recorded", async () => {
    const moved = await artwork(1);
    const never = await artwork(2);
    const storeRoom = await add("Store room");
    const framer = await add("Framer");
    await move(moved.id, storeRoom.id, T1);
    await move(moved.id, framer.id, T2);

    const sources = await reader.read([never.id, moved.id, moved.id]);
    const byId = new Map(sources.map((source) => [source.registerId, source]));
    expect(sources).toHaveLength(2);
    expect(byId.get(moved.id)).toEqual({
      registerId: moved.id,
      stockCode: moved.stockCode,
      zohoProductId: "zloc-1",
      location: { id: framer.id, name: "Framer", status: "active" },
    });
    expect(byId.get(never.id)?.location).toBeNull();
  });

  it("reads a retired location as retired, so the mirror can say so", async () => {
    const entry = await artwork(3);
    const framer = await add("Framer");
    await move(entry.id, framer.id, T1);
    const retired = await store.setLocationStatus({
      id: framer.id,
      expectedVersion: framer.version,
      status: "retired",
      now: T2,
    });
    expect(retired.ok).toBe(true);

    const [source] = await reader.read([entry.id]);
    expect(source?.location).toEqual({ id: framer.id, name: "Framer", status: "retired" });
  });

  it("leaves out prints, unknown ids and malformed ids", async () => {
    const original = await artwork(4);
    await db.execute(
      sql`UPDATE artwork_register
             SET kind = 'print', stock_code = 'LAX-PRI-PH-GAC-26-0004', source_original_id = NULL
           WHERE id = ${original.id}`,
    );
    expect(
      await reader.read([original.id, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]),
    ).toEqual([]);
  });
});
