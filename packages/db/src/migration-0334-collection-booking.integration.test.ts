import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

const drizzle = (name: string) =>
  readFile(resolve(import.meta.dirname, "../drizzle", name), "utf8");

type Fixture = {
  userId: string;
  entityId: string;
  venueId: string;
  lot: () => Promise<string>;
  booking: (over?: Record<string, unknown>) => Promise<string>;
};

/** Real rows for everything a booking points at. */
async function fixture(pool: pg.Pool): Promise<Fixture> {
  const userId = `col-user-${randomUUID()}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, $1, $2, true, now(), now())`,
    [userId, `${userId}@integration.test`],
  );
  await pool.query(
    `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
     values ($1, 'Buyer', 'individual', 'private_collector', $2, 'approved')`,
    [entityId, userId],
  );
  await pool.query(
    `insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
     values ($1, $2, 'Gallery', '156 New Cavendish Street', 'London', 'W1W 6YW', 'GB')`,
    [venueId, entityId],
  );
  const f: Fixture = {
    userId,
    entityId,
    venueId,
    async lot() {
      const id = randomUUID();
      await pool.query(
        `insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
           current_price, start_time, end_time, status)
         values ($1, $2, $3, 'english', 100, 100, now() - interval '30 days',
           now() - interval '20 days', 'ended')`,
        [id, entityId, `Lot ${id.slice(0, 8)}`],
      );
      return id;
    },
    async booking(over = {}) {
      const id = randomUUID();
      const row = {
        id,
        legal_entity_id: entityId,
        venue_id: venueId,
        slot_start: "2026-11-12T14:00:00Z",
        slot_end: "2026-11-12T14:30:00Z",
        seat: 1,
        collector_kind: "self",
        collector_name: "Charlotte Hayes",
        idempotency_key: randomUUID(),
        request_fingerprint: "fingerprint",
        ...over,
      };
      const keys = Object.keys(row);
      await pool.query(
        `insert into collection_booking (${keys.join(", ")})
         values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
        Object.values(row),
      );
      return id;
    },
  };
  return f;
}

async function code(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

const UNIQUE = "23505";
const CHECK = "23514";

describe.skipIf(!migrationUrl)("migration 0334 collection booking", { timeout: 120_000 }, () => {
  it("applies, numbers references from COL-1000, and keeps its rules", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);

      await pool.query("insert into collection_place (venue_id) values ($1)", [f.venueId]);
      const { rows } = await pool.query("select * from collection_place where venue_id = $1", [
        f.venueId,
      ]);
      expect(rows[0]).toMatchObject({
        online_booking_enabled: false,
        visit_minutes: 30,
        places_per_slot: 2,
        notice_cutoff_local: "16:00",
        notice_working_days: 1,
        window_days: 28,
        close_on_sale_days: true,
        undo_hand_over_minutes: 10,
        free_storage_days: null,
      });

      const a = await f.booking({ seat: 1 });
      const b = await f.booking({ seat: 2 });
      const refs = await pool.query<{ id: string; reference: string }>(
        "select id, reference from collection_booking where id = any($1) order by reference",
        [[a, b]],
      );
      expect(refs.rows.map((r) => r.reference)).toEqual(["COL-1000", "COL-1001"]);
    });
  });

  it("refuses a place that is out of range", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const insert = (column: string, value: string | number) =>
        pool.query(`insert into collection_place (venue_id, ${column}) values ($1, $2)`, [
          f.venueId,
          value,
        ]);
      expect(await code(insert("visit_minutes", 25))).toBe(CHECK);
      expect(await code(insert("places_per_slot", 0))).toBe(CHECK);
      expect(await code(insert("places_per_slot", 11))).toBe(CHECK);
      expect(await code(insert("notice_cutoff_local", "4pm"))).toBe(CHECK);
      expect(await code(insert("notice_cutoff_local", "24:00"))).toBe(CHECK);
      expect(await code(insert("notice_working_days", 0))).toBe(CHECK);
      expect(await code(insert("window_days", 3))).toBe(CHECK);
      expect(await code(insert("undo_hand_over_minutes", 61))).toBe(CHECK);
      expect(await code(insert("free_storage_days", -1))).toBe(CHECK);
    });
  });

  it("holds hours and exceptions to their shape", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const hours = (weekday: number, opens: string, closes: string) =>
        pool.query(
          `insert into collection_weekly_hours (venue_id, weekday, opens_local, closes_local)
           values ($1, $2, $3, $4)`,
          [f.venueId, weekday, opens, closes],
        );
      await hours(1, "10:00", "13:00");
      await hours(1, "14:00", "19:00");
      expect(await code(hours(1, "10:00", "12:00"))).toBe(UNIQUE);
      expect(await code(hours(8, "10:00", "19:00"))).toBe(CHECK);
      expect(await code(hours(2, "19:00", "10:00"))).toBe(CHECK);
      expect(await code(hours(2, "10:00", "10:00"))).toBe(CHECK);
      expect(await code(hours(2, "9:00", "10:00"))).toBe(CHECK);

      const exception = (over: Record<string, unknown>) => {
        const row = {
          venue_id: f.venueId,
          kind: "closure",
          starts_on: "2026-12-25",
          ends_on: "2026-12-25",
          ...over,
        };
        const keys = Object.keys(row);
        return pool.query(
          `insert into collection_exception (${keys.join(", ")})
           values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          Object.values(row),
        );
      };
      await exception({});
      await exception({
        opens_local: "13:00",
        closes_local: "14:00",
        starts_on: "2026-12-26",
        ends_on: "2026-12-26",
      });
      expect(await code(exception({ kind: "holiday" }))).toBe(CHECK);
      expect(await code(exception({ source: "other" }))).toBe(CHECK);
      expect(await code(exception({ ends_on: "2026-12-24" }))).toBe(CHECK);
      expect(await code(exception({ opens_local: "13:00" }))).toBe(CHECK);
      expect(await code(exception({ opens_local: "14:00", closes_local: "13:00" }))).toBe(CHECK);
      // A sale closure names its sale, and only a sale closure does.
      expect(await code(exception({ source: "sale" }))).toBe(CHECK);
      expect(await code(exception({ sale_id: randomUUID() }))).toBe(CHECK);
    });
  });

  it("imports each bank holiday once", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const holiday = () =>
        pool.query(
          `insert into collection_exception (venue_id, kind, starts_on, ends_on, source)
           values ($1, 'closure', '2026-12-25', '2026-12-25', 'bank_holiday')`,
          [f.venueId],
        );
      await holiday();
      expect(await code(holiday())).toBe(UNIQUE);
      // Removed by staff, it can be imported again.
      await pool.query(
        "update collection_exception set deleted_at = now() where source = 'bank_holiday'",
      );
      await holiday();
    });
  });

  it("gives no place twice in a slot while a booking is live", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);

      const first = await f.booking({ seat: 1 });
      expect(await code(f.booking({ seat: 1 }))).toBe(UNIQUE);
      // Another place in the same slot, and the same place in another slot, are fine.
      await f.booking({ seat: 2 });
      await f.booking({
        seat: 1,
        slot_start: "2026-11-12T14:30:00Z",
        slot_end: "2026-11-12T15:00:00Z",
      });

      // A cancelled booking gives its place back.
      await pool.query("update collection_booking set status = 'cancelled' where id = $1", [first]);
      await f.booking({ seat: 1 });
      // ...and the place it was given to is held again.
      expect(await code(f.booking({ seat: 1 }))).toBe(UNIQUE);
    });
  });

  it("books a repeated request once, per account", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      await f.booking({ seat: 1, idempotency_key: "key-1" });
      expect(await code(f.booking({ seat: 2, idempotency_key: "key-1" }))).toBe(UNIQUE);
      await f.booking({ seat: 2, idempotency_key: "key-2" });
    });
  });

  it("holds a lot in one live booking, and frees it when the booking ends", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const lot = await f.lot();
      const a = await f.booking({ seat: 1 });
      const b = await f.booking({ seat: 2 });
      const attach = (booking: string) =>
        pool.query("insert into collection_booking_lot (booking_id, lot_id) values ($1, $2)", [
          booking,
          lot,
        ]);
      await attach(a);
      expect(await code(attach(b))).toBe(UNIQUE);
      await pool.query("update collection_booking_lot set active = false where booking_id = $1", [
        a,
      ]);
      await attach(b);
      // The same lot twice in one booking is the primary key.
      expect(await code(attach(b))).toBe(UNIQUE);
    });
  });

  it("refuses bookings the rules do not allow", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      expect(await code(f.booking({ status: "pending" }))).toBe(CHECK);
      expect(await code(f.booking({ seat: 0 }))).toBe(CHECK);
      expect(await code(f.booking({ seat: 51 }))).toBe(CHECK);
      expect(await code(f.booking({ slot_end: "2026-11-12T14:00:00Z" }))).toBe(CHECK);
      expect(await code(f.booking({ collector_kind: "stranger" }))).toBe(CHECK);
      expect(await code(f.booking({ id_check_type: "passport_number" }))).toBe(CHECK);
      expect(await code(f.booking({ ics_sequence: -1 }))).toBe(CHECK);
      // Only staff go over capacity.
      expect(await code(f.booking({ over_capacity: true }))).toBe(CHECK);
      await f.booking({ over_capacity: true, booked_via: "staff", seat: 3 });
    });
  });

  it("keeps a booking when the person who made it is deleted", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const booker = `col-booker-${randomUUID()}`;
      await pool.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at)
         values ($1, $1, $2, true, now(), now())`,
        [booker, `${booker}@integration.test`],
      );
      const id = await f.booking({
        booked_by_user_id: booker,
        authorised_by_user_id: booker,
        collector_kind: "third_party",
        authorised_at: "2026-11-09T10:00:00Z",
      });
      await pool.query(`delete from "user" where id = $1`, [booker]);
      const { rows } = await pool.query(
        "select booked_by_user_id, authorised_by_user_id, collector_name from collection_booking where id = $1",
        [id],
      );
      expect(rows[0]).toEqual({
        booked_by_user_id: null,
        authorised_by_user_id: null,
        collector_name: "Charlotte Hayes",
      });
    });
  });

  it("is idempotent", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const forward = await drizzle("0334_collection_booking.sql");
      await pool.query(forward);
      await pool.query(forward);
    });
  });

  it("rolls back only when no visit is booked, and forward again afterwards", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const rollback = await drizzle("0334_rollback.sql");
      const forward = await drizzle("0334_collection_booking.sql");
      const f = await fixture(pool);
      const id = await f.booking({ seat: 1 });

      // A live booking stops the rollback, so no promised visit is dropped silently.
      await expect(pool.query(rollback)).rejects.toThrow(/live collection bookings exist/);
      const stillThere = await pool.query("select count(*)::int as n from collection_booking");
      expect(stillThere.rows[0]?.n).toBe(1);

      await pool.query("update collection_booking set status = 'cancelled' where id = $1", [id]);
      await pool.query(rollback);
      const gone = await pool.query<{ name: string | null }>(
        `select to_regclass('public.collection_booking')::text as name`,
      );
      expect(gone.rows[0]?.name).toBeNull();
      const column = await pool.query(
        `select 1 from information_schema.columns
         where table_name = 'lot_fulfilment' and column_name = 'collected_by_user_id'`,
      );
      expect(column.rowCount).toBe(0);

      await pool.query(forward);
      const back = await pool.query<{ name: string | null }>(
        `select to_regclass('public.collection_booking')::text as name`,
      );
      expect(back.rows[0]?.name).toBe("collection_booking");
    });
  });
});
