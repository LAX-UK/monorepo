import { MOVE_BATCH_MAX, type NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository, DrizzleStockLocationStore } from "./index.js";

const url = process.env.DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-17T09:00:00.000Z");
const T1 = new Date("2026-11-17T10:00:00.000Z");
const T2 = new Date("2026-11-17T11:00:00.000Z");
const STAFF = "staff:s1";

/** One connection of its own, to hold a lock while the store runs on the pool. */
type HeldClient = {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
  release(): void;
};
const lockerDb = url ? createDb(url) : (null as never);
const lockerPool = url
  ? (lockerDb as unknown as { $client: { connect(): Promise<HeldClient>; end(): Promise<void> } })
      .$client
  : (null as never);

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

  afterAll(async () => {
    await clear();
    await lockerPool.end();
  });

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
    const rows = await db.execute<{ from_id: string | null; to_id: string; reason: string }>(
      sql`SELECT payload->>'fromLocationId' AS from_id, payload->>'toLocationId' AS to_id,
                 payload->>'reason' AS reason
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
      expect(await store.listMoves(work.id, 10)).toEqual([]);
      expect((await store.currentLocations([work.id])).has(work.id)).toBe(false);
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
      expect((await store.listMoves(work.id, 1))[0]).toMatchObject({
        to: { id: room.id, name: "Gallery main room", status: "active" },
        movedAt: T1,
        movedBy: STAFF,
        note: "Hung for the winter show",
      });
      expect(await historyTypes(work.id)).toContain("location_moved");
      expect(await locationEvents(work.id)).toEqual([
        { from_id: null, to_id: room.id, reason: "moved" },
      ]);
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
      expect(moves[0]?.to.name).toBe("Store room");
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
      const [latest] = await store.listMoves(work.id, 1);
      expect(latest?.to.id).toBe(two.id);
      expect(latest?.movedAt).toEqual(new Date(T1.getTime() + 1));
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
      expect((await store.listMoves(work.id, 1))[0]?.to).toEqual({
        id: old.id,
        name: "Basement",
        status: "retired",
      });
      expect((await store.listMoves(work.id, 10))[0]?.to.status).toBe("retired");
    });

    it("refuses more than MOVE_BATCH_MAX artworks before taking any lock", async () => {
      const work = await artwork(1);
      const room = await add("Store room");
      const many = Array.from(
        { length: MOVE_BATCH_MAX },
        (_, n) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
      );
      // Exactly the limit is taken (the unknown ids are named, not refused) ...
      const atLimit = await store.moveArtworks({
        registerIds: [work.id, ...many.slice(1)],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T1,
      });
      expect(atLimit).toMatchObject({ ok: true, moved: [{ registerId: work.id }] });
      // ... and one more is refused with nothing recorded.
      expect(
        await store.moveArtworks({
          registerIds: [work.id, ...many],
          locationId: room.id,
          note: null,
          actor: STAFF,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "too_many" });
      expect(await store.listMoves(work.id, 10)).toHaveLength(1);
    });
  });

  describe("changes to the list", () => {
    it("tells every artwork at a renamed location, and no other", async () => {
      const a = await artwork(1);
      const b = await artwork(2);
      const elsewhere = await artwork(3);
      const leftIt = await artwork(4);
      const room = await add("Store room");
      const framer = await add("Framer");
      const move = (registerIds: string[], locationId: string, now: Date) =>
        store.moveArtworks({ registerIds, locationId, note: null, actor: STAFF, now });
      await move([a.id, b.id, leftIt.id], room.id, T0);
      await move([elsewhere.id], framer.id, T0);
      await move([leftIt.id], framer.id, T1);

      const renamed = await store.updateLocation({
        id: room.id,
        expectedVersion: room.version,
        name: "Store room B",
        note: null,
        now: T2,
      });
      expect(renamed).toMatchObject({ ok: true, changed: true });
      for (const work of [a, b]) {
        expect((await locationEvents(work.id)).at(-1)).toEqual({
          from_id: room.id,
          to_id: room.id,
          reason: "location_updated",
        });
      }
      // Moved away before the rename, or never there: nothing new.
      expect((await locationEvents(leftIt.id)).map((e) => e.reason)).toEqual(["moved", "moved"]);
      expect((await locationEvents(elsewhere.id)).map((e) => e.reason)).toEqual(["moved"]);
      // A refused rename publishes nothing.
      await store.updateLocation({
        id: room.id,
        expectedVersion: room.version,
        name: "Stale",
        note: null,
        now: T2,
      });
      expect(await locationEvents(a.id)).toHaveLength(2);
    });

    it("tells the artworks at a location when it is retired and when it is restored", async () => {
      const work = await artwork(1);
      const room = await add("Basement");
      await store.moveArtworks({
        registerIds: [work.id],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T0,
      });
      const retired = await store.setLocationStatus({
        id: room.id,
        expectedVersion: room.version,
        status: "retired",
        now: T1,
      });
      if (!retired.ok) throw new Error(retired.reason);
      await store.setLocationStatus({
        id: room.id,
        expectedVersion: retired.location.version,
        status: "active",
        now: T2,
      });
      expect((await locationEvents(work.id)).map((e) => e.reason)).toEqual([
        "moved",
        "location_retired",
        "location_restored",
      ]);
    });

    it("leaves a retired location as it was when it is retired again", async () => {
      const work = await artwork(1);
      const room = await add("Basement");
      await store.moveArtworks({
        registerIds: [work.id],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T0,
      });
      const first = await store.setLocationStatus({
        id: room.id,
        expectedVersion: room.version,
        status: "retired",
        now: T1,
      });
      if (!first.ok) throw new Error(first.reason);
      const again = await store.setLocationStatus({
        id: room.id,
        expectedVersion: first.location.version,
        status: "retired",
        now: T2,
      });
      expect(again).toEqual({ ok: true, changed: false, location: first.location });
      const stored = await store.findLocation(room.id);
      expect(stored?.version).toBe(first.location.version);
      expect(stored?.retiredAt).toEqual(T1);
      expect((await locationEvents(work.id)).map((e) => e.reason)).toEqual([
        "moved",
        "location_retired",
      ]);
    });
    it("changes nothing when a location is saved with the name and note it has", async () => {
      const work = await artwork(1);
      const room = await add("Store room");
      await store.moveArtworks({
        registerIds: [work.id],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T0,
      });
      const same = await store.updateLocation({
        id: room.id,
        expectedVersion: room.version,
        name: "Store room",
        note: null,
        now: T1,
      });
      expect(same).toEqual({ ok: true, changed: false, location: room });
      expect((await store.findLocation(room.id))?.version).toBe(room.version);
      expect((await locationEvents(work.id)).map((e) => e.reason)).toEqual(["moved"]);
      // A change of case is a change.
      const recased = await store.updateLocation({
        id: room.id,
        expectedVersion: room.version,
        name: "Store Room",
        note: null,
        now: T1,
      });
      expect(recased).toMatchObject({ ok: true, changed: true, location: { version: 2 } });
      expect(
        await store.updateLocation({
          id: "00000000-0000-4000-8000-000000000000",
          expectedVersion: 1,
          name: "Store room",
          note: null,
          now: T1,
        }),
      ).toEqual({ ok: false, reason: "not_found" });
    });

    it("refuses a save from an older version as stale, even when the values match again", async () => {
      const room = await add("Store room");
      // Someone else renames it and back again (version 3), while this edit opened at version 1.
      const renamed = await store.updateLocation({
        id: room.id,
        expectedVersion: room.version,
        name: "Framer",
        note: null,
        now: T1,
      });
      if (!renamed.ok) throw new Error(renamed.reason);
      await store.updateLocation({
        id: room.id,
        expectedVersion: renamed.location.version,
        name: "Store room",
        note: null,
        now: T1,
      });
      expect(
        await store.updateLocation({
          id: room.id,
          expectedVersion: room.version,
          name: "Store room",
          note: null,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "stale" });
      expect((await store.findLocation(room.id))?.version).toBe(room.version + 2);
    });

    it("keeps a caller's transaction usable after refusing a taken name", async () => {
      await add("Store room");
      const after = await db.transaction(async (tx) => {
        const refused = await new DrizzleStockLocationStore(tx as unknown as Database).addLocation({
          name: "store room",
          note: null,
          actor: STAFF,
          now: T1,
        });
        expect(refused).toEqual({ ok: false, reason: "name_taken" });
        // Without the store's savepoint Postgres refuses this: the transaction is aborted.
        const added = await new DrizzleStockLocationStore(tx as unknown as Database).addLocation({
          name: "Framer",
          note: null,
          actor: STAFF,
          now: T1,
        });
        return added.ok;
      });
      expect(after).toBe(true);
      expect((await store.listLocations()).map((l) => l.name)).toEqual(["Framer", "Store room"]);
    });
  });

  /**
   * Each test holds a lock on a connection of its own, runs the store on the pool, and checks the
   * store is blocked by it (pg_blocking_pids) before releasing it. Without the lock under test the
   * store does not wait and records against what it read before the other change committed.
   */
  describe("locks", () => {
    let held: HeldClient | null = null;

    async function hold(statement: string, params: unknown[]): Promise<HeldClient> {
      const client = await lockerPool.connect();
      held = client;
      await client.query("BEGIN");
      await client.query(statement, params);
      return client;
    }

    async function release(client: HeldClient, end: "COMMIT" | "ROLLBACK") {
      await client.query(end);
      client.release();
      held = null;
    }

    /** True once a backend is waiting on `client`'s locks; false if none does within 5s. */
    async function blockedBy(client: HeldClient): Promise<boolean> {
      const [{ pid } = { pid: 0 }] = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await db.execute<{ waiting: number }>(
          sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
               WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`,
        );
        if ((rows.rows[0]?.waiting ?? 0) > 0) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return false;
    }

    afterEach(async () => {
      if (held) await release(held, "ROLLBACK");
    });

    async function moveIn(client: HeldClient, registerId: string, locationId: string, at: Date) {
      await client.query(
        `INSERT INTO artwork_location_move (register_id, location_id, moved_at, moved_by)
         VALUES ($1, $2, $3, 'staff:other')`,
        [registerId, locationId, at],
      );
    }

    it("makes a second move of an artwork wait for the first, then start from where it left it", async () => {
      const work = await artwork(1);
      const one = await add("Store room");
      const two = await add("Framer");
      // Another move of the same artwork, part way through: it holds the artwork's row lock.
      const other = await hold("SELECT id FROM artwork_register WHERE id = $1 FOR NO KEY UPDATE", [
        work.id,
      ]);
      const pending = store.moveArtworks({
        registerIds: [work.id],
        locationId: two.id,
        note: null,
        actor: STAFF,
        now: T1,
      });
      expect(await blockedBy(other)).toBe(true);
      await moveIn(other, work.id, one.id, T1);
      await release(other, "COMMIT");

      expect(await pending).toEqual({
        ok: true,
        moved: [{ registerId: work.id, fromLocationId: one.id }],
        unchanged: [],
        notFound: [],
      });
      // One current location, and a chain with no fork: the later move left the earlier one's.
      const moves = await store.listMoves(work.id, 10);
      expect(moves.map((m) => [m.from?.id ?? null, m.to.id])).toEqual([
        [one.id, two.id],
        [null, one.id],
      ]);
      expect((await store.currentLocations([work.id])).get(work.id)?.location.id).toBe(two.id);
      expect(moves[0]?.movedAt).toEqual(new Date(T1.getTime() + 1));
    });

    it("records nothing for the waiting move when the first took the artwork to the same place", async () => {
      const work = await artwork(1);
      const room = await add("Store room");
      const other = await hold("SELECT id FROM artwork_register WHERE id = $1 FOR NO KEY UPDATE", [
        work.id,
      ]);
      const pending = store.moveArtworks({
        registerIds: [work.id],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T1,
      });
      expect(await blockedBy(other)).toBe(true);
      await moveIn(other, work.id, room.id, T1);
      await release(other, "COMMIT");

      expect(await pending).toEqual({ ok: true, moved: [], unchanged: [work.id], notFound: [] });
      expect(await store.listMoves(work.id, 10)).toHaveLength(1);
    });

    it("makes a move into a location wait while it is being retired, then refuses it", async () => {
      const work = await artwork(1);
      const room = await add("Basement");
      // Retiring, part way through: the location's row is updated but not committed.
      const retiring = await hold(
        `UPDATE artwork_location SET status = 'retired', retired_at = now(), version = version + 1
          WHERE id = $1`,
        [room.id],
      );
      const pending = store.moveArtworks({
        registerIds: [work.id],
        locationId: room.id,
        note: null,
        actor: STAFF,
        now: T1,
      });
      expect(await blockedBy(retiring)).toBe(true);
      await release(retiring, "COMMIT");

      expect(await pending).toEqual({ ok: false, reason: "location_retired" });
      expect(await store.listMoves(work.id, 10)).toEqual([]);
      expect(await locationEvents(work.id)).toEqual([]);
    });

    it("makes retiring wait for a move into the location, then tells the artwork it moved in", async () => {
      const work = await artwork(1);
      const room = await add("Basement");
      // A move into the location, part way through: it holds the location's share lock.
      const moving = await hold("SELECT id FROM artwork_location WHERE id = $1 FOR SHARE", [
        room.id,
      ]);
      const pending = store.setLocationStatus({
        id: room.id,
        expectedVersion: room.version,
        status: "retired",
        now: T2,
      });
      expect(await blockedBy(moving)).toBe(true);
      await moveIn(moving, work.id, room.id, T1);
      await release(moving, "COMMIT");

      expect(await pending).toMatchObject({ ok: true, changed: true });
      expect((await locationEvents(work.id)).map((e) => e.reason)).toEqual(["location_retired"]);
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
