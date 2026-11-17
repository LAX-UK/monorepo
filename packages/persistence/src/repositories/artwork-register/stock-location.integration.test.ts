import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository, DrizzleStockLocationStore } from "./index.js";

const url = process.env.DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-17T09:00:00.000Z");
const T1 = new Date("2026-11-17T10:00:00.000Z");
const T2 = new Date("2026-11-17T11:00:00.000Z");
const STAFF = "staff:s1";

function newEntry(n: number): NewArtworkRegisterEntry {
  return {
    zohoProductId: `loc-${n}`,
    stockCode: `LAX-ORI-PH-GAC-26-${String(n).padStart(4, "0")}`,
    kind: "original",
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

describe.skipIf(!url)("stock location (Postgres)", { timeout: 30_000 }, () => {
  const register = new DrizzleArtworkRegisterRepository(db);
  const store = new DrizzleStockLocationStore(db);

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

  async function locationEvents(registerId: string) {
    const rows = await db.execute<{ from_id: string | null; to_id: string }>(
      sql`SELECT payload->>'fromLocationId' AS from_id, payload->>'toLocationId' AS to_id
            FROM domain_events
           WHERE aggregate_id = ${registerId} AND event_type = 'artwork_register.location_changed'
           ORDER BY id`,
    );
    return rows.rows;
  }

  async function historyTypes(registerId: string) {
    return (await register.listEvents(registerId, 20)).map((event) => event.type);
  }

  describe("the list of locations", () => {
    it("refuses a second location with the same name in another case", async () => {
      await add("Store room");
      expect(
        await store.addLocation({ name: "STORE ROOM", note: null, actor: STAFF, now: T1 }),
      ).toEqual({ ok: false, reason: "name_taken" });
    });

    it("renames with the version it read, and refuses a stale version or a taken name", async () => {
      const framer = await add("Framer");
      await add("Store room");
      const renamed = await store.updateLocation({
        id: framer.id,
        expectedVersion: framer.version,
        name: "Framer (Kentish Town)",
        note: "Collected on Fridays",
        now: T1,
      });
      expect(renamed).toMatchObject({
        ok: true,
        location: { name: "Framer (Kentish Town)", note: "Collected on Fridays", version: 2 },
      });
      expect(
        await store.updateLocation({
          id: framer.id,
          expectedVersion: framer.version,
          name: "Framer",
          note: null,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "stale" });
      expect(
        await store.updateLocation({
          id: framer.id,
          expectedVersion: 2,
          name: "store room",
          note: null,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "name_taken" });
      expect(
        await store.updateLocation({
          id: "00000000-0000-4000-8000-000000000000",
          expectedVersion: 1,
          name: "Nowhere",
          note: null,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "not_found" });
    });

    it("lists active locations by name, and retired ones only when asked, after them", async () => {
      const zebra = await add("zebra wall");
      await add("Alcove");
      const old = await add("Basement");
      await store.setLocationStatus({
        id: old.id,
        expectedVersion: old.version,
        status: "retired",
        now: T1,
      });
      expect((await store.listLocations()).map((l) => l.name)).toEqual(["Alcove", "zebra wall"]);
      const all = await store.listLocations({ includeRetired: true });
      expect(all.map((l) => [l.name, l.status])).toEqual([
        ["Alcove", "active"],
        ["zebra wall", "active"],
        ["Basement", "retired"],
      ]);
      expect(all[2]?.retiredAt).toEqual(T1);
      expect(zebra.retiredAt).toBeNull();
    });
  });

  describe("moving artworks", () => {
    it("reads Location not recorded (null) until the first move", async () => {
      const work = await artwork(1);
      expect(await store.currentLocation(work.id)).toBeNull();
      expect(await store.listMoves(work.id, 10)).toEqual([]);
    });

    it("records a move with its history entry and one location_changed event", async () => {
      const work = await artwork(1);
      const room = await add("Gallery main room");
      const result = await store.moveArtworks({
        registerIds: [work.id],
        locationId: room.id,
        note: "Hung for the winter show",
        actor: STAFF,
        now: T1,
      });
      expect(result).toEqual({
        ok: true,
        moved: [{ registerId: work.id, fromLocationId: null }],
        unchanged: [],
        notFound: [],
      });
      expect(await store.currentLocation(work.id)).toEqual({
        location: { id: room.id, name: "Gallery main room", status: "active" },
        movedAt: T1,
        movedBy: STAFF,
      });
      expect(await historyTypes(work.id)).toContain("location_moved");
      expect(await locationEvents(work.id)).toEqual([{ from_id: null, to_id: room.id }]);
    });

    it("keeps every move with where it came from, newest first; the latest is current", async () => {
      const work = await artwork(1);
      const store1 = await add("Store room");
      const framer = await add("Framer");
      for (const [to, at] of [
        [store1, T0],
        [framer, T1],
        [store1, T2],
      ] as const) {
        await store.moveArtworks({
          registerIds: [work.id],
          locationId: to.id,
          note: null,
          actor: STAFF,
          now: at,
        });
      }
      const moves = await store.listMoves(work.id, 10);
      expect(moves.map((m) => [m.from?.name ?? null, m.to.name])).toEqual([
        ["Framer", "Store room"],
        ["Store room", "Framer"],
        [null, "Store room"],
      ]);
      // The window runs before the limit, so the newest move still knows where it came from.
      expect((await store.listMoves(work.id, 1))[0]?.from?.name).toBe("Framer");
      expect((await store.currentLocation(work.id))?.location.name).toBe("Store room");
      expect((await locationEvents(work.id)).map((e) => e.from_id)).toEqual([
        null,
        store1.id,
        framer.id,
      ]);
    });

    it("records nothing when the artwork is already there", async () => {
      const work = await artwork(1);
      const room = await add("Store room");
      const input = {
        registerIds: [work.id],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T1,
      };
      await store.moveArtworks(input);
      expect(await store.moveArtworks({ ...input, now: T2 })).toEqual({
        ok: true,
        moved: [],
        unchanged: [work.id],
        notFound: [],
      });
      expect(await store.listMoves(work.id, 10)).toHaveLength(1);
      expect(await locationEvents(work.id)).toHaveLength(1);
    });

    it("moves a selection at once, each once, and names the ones not on the register", async () => {
      const a = await artwork(1);
      const b = await artwork(2);
      const c = await artwork(3);
      const room = await add("Store room");
      const hang = await add("Gallery main room");
      await store.moveArtworks({
        registerIds: [c.id],
        locationId: hang.id,
        note: null,
        actor: STAFF,
        now: T0,
      });
      const missing = "00000000-0000-4000-8000-000000000000";
      const result = await store.moveArtworks({
        registerIds: [a.id, b.id, a.id, c.id, missing],
        locationId: hang.id,
        note: "Winter hang",
        actor: STAFF,
        now: T1,
      });
      if (!result.ok) throw new Error(result.reason);
      expect(result.moved.map((m) => m.registerId).sort()).toEqual([a.id, b.id].sort());
      expect(result.unchanged).toEqual([c.id]);
      expect(result.notFound).toEqual([missing]);
      const now = await store.currentLocations([a.id, b.id, c.id]);
      expect([...now.values()].map((v) => v.location.id)).toEqual([hang.id, hang.id, hang.id]);
      expect(room.status).toBe("active");
    });

    it("stamps a move after the previous one when the clock repeats", async () => {
      const work = await artwork(1);
      const one = await add("Store room");
      const two = await add("Framer");
      for (const to of [one, two]) {
        await store.moveArtworks({
          registerIds: [work.id],
          locationId: to.id,
          note: null,
          actor: STAFF,
          now: T1,
        });
      }
      expect((await store.currentLocation(work.id))?.location.id).toBe(two.id);
      expect((await store.currentLocation(work.id))?.movedAt).toEqual(new Date(T1.getTime() + 1));
    });

    it("refuses a retired or unknown location and records nothing", async () => {
      const work = await artwork(1);
      const old = await add("Basement");
      await store.setLocationStatus({
        id: old.id,
        expectedVersion: old.version,
        status: "retired",
        now: T1,
      });
      expect(
        await store.moveArtworks({
          registerIds: [work.id],
          locationId: old.id,
          note: null,
          actor: STAFF,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "location_retired" });
      expect(
        await store.moveArtworks({
          registerIds: [work.id],
          locationId: "00000000-0000-4000-8000-000000000000",
          note: null,
          actor: STAFF,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "location_not_found" });
      expect(await store.listMoves(work.id, 10)).toEqual([]);
      expect(await locationEvents(work.id)).toEqual([]);
    });

    it("keeps reading a retired location in history and as the current location", async () => {
      const work = await artwork(1);
      const old = await add("Basement");
      await store.moveArtworks({
        registerIds: [work.id],
        locationId: old.id,
        note: null,
        actor: STAFF,
        now: T0,
      });
      await store.setLocationStatus({
        id: old.id,
        expectedVersion: old.version,
        status: "retired",
        now: T1,
      });
      expect((await store.currentLocation(work.id))?.location).toEqual({
        id: old.id,
        name: "Basement",
        status: "retired",
      });
      expect((await store.listMoves(work.id, 10))[0]?.to.status).toBe("retired");
    });

    it("lets two overlapping moves of one artwork take turns, so the history stays a chain", async () => {
      const work = await artwork(1);
      const one = await add("Store room");
      const two = await add("Framer");
      await Promise.all(
        [one, two].map((to) =>
          store.moveArtworks({
            registerIds: [work.id],
            locationId: to.id,
            note: null,
            actor: STAFF,
            now: T1,
          }),
        ),
      );
      const moves = await store.listMoves(work.id, 10);
      expect(moves).toHaveLength(2);
      // The later move came from the earlier one's location: no lost or forked step.
      expect(moves[0]?.from?.id).toBe(moves[1]?.to.id);
      expect((await locationEvents(work.id))[1]?.from_id).toBe(moves[1]?.to.id);
    });
  });

  describe.skipIf(!shopUrl)("as LAX Admin's database role", () => {
    const shopDb = shopUrl ? createDb(shopUrl) : (null as never);
    const shopStore = new DrizzleStockLocationStore(shopDb);

    it("adds a location, retires it and moves an artwork with shop_app's grants", async () => {
      const work = await artwork(1);
      const added = await shopStore.addLocation({
        name: "Store room",
        note: "Racks A to F",
        actor: STAFF,
        now: T0,
      });
      if (!added.ok) throw new Error(added.reason);
      const moved = await shopStore.moveArtworks({
        registerIds: [work.id],
        locationId: added.location.id,
        note: null,
        actor: STAFF,
        now: T1,
      });
      expect(moved.ok).toBe(true);
      const retired = await shopStore.setLocationStatus({
        id: added.location.id,
        expectedVersion: added.location.version,
        status: "retired",
        now: T2,
      });
      expect(retired.ok).toBe(true);
      expect((await shopStore.listMoves(work.id, 5))[0]?.to.status).toBe("retired");
    });
  });
});
