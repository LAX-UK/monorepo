import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
/** The file as one script inside the test's transaction: no breakpoints, BEGIN or COMMIT. */
const script = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8")
    .replaceAll("--> statement-breakpoint", "")
    .replace(/^BEGIN;$/m, "")
    .replace(/^COMMIT;$/m, "");

/**
 * Runs against a database migrated to the head. Each test runs in a transaction that is always
 * rolled back, so nothing it writes is left behind.
 */
describe.skipIf(!migrationUrl)(
  "migration 0404 stock location (Postgres)",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;
    let registerId: string;

    beforeAll(async () => {
      client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    beforeEach(async () => {
      await client.query("BEGIN");
      const row = await client.query<{ id: string }>(
        `insert into artwork_register (zoho_product_id, stock_code, kind, title, artist_name, artist_code)
       values ('loc-mig-1', 'LAX-ORI-AAA-LOC-26-0001', 'original', 'Work', 'Artist', 'AAA')
       returning id`,
      );
      registerId = row.rows[0]?.id as string;
    });

    afterEach(async () => {
      await client.query("ROLLBACK");
    });

    async function location(name: string): Promise<string> {
      const row = await client.query<{ id: string }>(
        `insert into artwork_location (name, created_by) values ($1, 'staff:s1') returning id`,
        [name],
      );
      return row.rows[0]?.id as string;
    }

    /** Runs the statement and returns "<SQLSTATE>: <message>" of the refusal; fails if it ran. */
    async function refused(sql: string, params: unknown[] = []): Promise<string> {
      await client.query("SAVEPOINT attempt");
      try {
        await client.query(sql, params);
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT attempt");
        const { code, message } = error as { code?: string; message: string };
        return `${code}: ${message}`;
      }
      throw new Error(`expected refusal: ${sql}`);
    }

    it("refuses a second location with the same name in another case", async () => {
      await location("Store room");
      expect(
        await refused(`insert into artwork_location (name, created_by) values ('store ROOM', 's')`),
      ).toMatch(/^23505/);
    });

    it("refuses names that are blank, padded or over 80 characters", async () => {
      for (const name of ["", " Store", "x".repeat(81)]) {
        expect(
          await refused(`insert into artwork_location (name, created_by) values ($1, 's')`, [name]),
        ).toMatch(/^23514/);
      }
    });

    it("refuses a retired location without the time it was retired", async () => {
      const id = await location("Framer");
      expect(
        await refused(`update artwork_location set status = 'retired' where id = $1`, [id]),
      ).toMatch(/^23514/);
      await client.query(
        `update artwork_location set status = 'retired', retired_at = now() where id = $1`,
        [id],
      );
    });

    it("keeps moves append-only and the location they point at", async () => {
      const id = await location("Gallery main room");
      const move = await client.query<{ id: string }>(
        `insert into artwork_location_move (register_id, location_id, moved_at, moved_by)
       values ($1, $2, now(), 'staff:s1') returning id`,
        [registerId, id],
      );
      const moveId = move.rows[0]?.id;
      expect(
        await refused(`update artwork_location_move set note = 'x' where id = $1`, [moveId]),
      ).toMatch(/append-only/);
      expect(await refused("delete from artwork_location_move where id = $1", [moveId])).toMatch(
        /append-only/,
      );
      expect(await refused("delete from artwork_location where id = $1", [id])).toMatch(/^23503/);
    });

    it("refuses a move note over 500 characters", async () => {
      const id = await location("On loan");
      expect(
        await refused(
          `insert into artwork_location_move (register_id, location_id, moved_at, moved_by, note)
         values ($1, $2, now(), 's', $3)`,
          [registerId, id, "n".repeat(501)],
        ),
      ).toMatch(/^23514/);
    });

    it("rolls back twice in a row and applies again", async () => {
      await client.query(script("0404_rollback.sql"));
      expect((await client.query("select to_regclass('artwork_location') as t")).rows[0]?.t).toBe(
        null,
      );
      await client.query(script("0404_rollback.sql"));
      await client.query(script("0404_artwork_stock_location.sql"));
      await location("Store room");
    });

    it("refuses to roll back while a move exists", async () => {
      const id = await location("Store room");
      await client.query(
        `insert into artwork_location_move (register_id, location_id, moved_at, moved_by)
       values ($1, $2, now(), 'staff:s1')`,
        [registerId, id],
      );
      expect(await refused(script("0404_rollback.sql"))).toMatch(/holds moves/);
    });

    it("accepts location_moved in the record's history", async () => {
      await client.query(
        `insert into artwork_register_event (register_id, type, actor) values ($1, 'location_moved', 'staff:s1')`,
        [registerId],
      );
    });
  },
);
