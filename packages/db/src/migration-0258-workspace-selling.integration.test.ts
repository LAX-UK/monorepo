import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

/** Runs in one transaction that is always rolled back. */
describe.skipIf(!migrationUrl)(
  "migration 0258 workspace selling modules",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;

    beforeAll(async () => {
      client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
      await client.connect();
    });

    afterAll(async () => {
      await client.query("rollback");
      await client.end();
    });

    beforeEach(async () => {
      await client.query("rollback");
      await client.query("begin");
      // Start from before 0258 so the backfill runs over rows that existed without a number.
      await client.query(read("0258_rollback.sql"));
    });

    async function seed() {
      const user = await client.query(
        `insert into "user" (id, email, name, created_at, updated_at)
         values (gen_random_uuid()::text, $1, 'Probe', now(), now()) returning id`,
        [`probe-${Date.now()}@example.com`],
      );
      const userId = user.rows[0].id as string;
      const entity = await client.query(
        `insert into legal_entity (display_name, kind, subkind, created_by_user_id, status)
         values ('Probe', 'organisation', 'gallery', $1, 'approved') returning id`,
        [userId],
      );
      const entityId = entity.rows[0].id as string;
      const lotRow = await client.query(
        `insert into lot (title, auction_type, starting_price, current_price, start_time, end_time,
           status, seller_legal_entity_id)
         values ('Unsold', 'english', 100, 100, now() - interval '3 days',
           '2026-11-01T18:00:00Z', 'ended', $1) returning id`,
        [entityId],
      );
      const lotId = lotRow.rows[0].id as string;
      for (const [title, created, converted] of [
        ["Later", "2026-02-01", null],
        ["Earlier", "2026-01-01", lotId],
      ] as const) {
        await client.query(
          `insert into item_submission (legal_entity_id, title, status, converted_lot_id, created_at, updated_at)
           values ($1, $2, 'converted', $3, $4, $4)`,
          [entityId, title, converted, created],
        );
      }
      return { entityId, lotId };
    }

    it("numbers consignments in the order they were created and keeps numbering after", async () => {
      const { entityId } = await seed();
      await client.query(read("0258_workspace_selling_modules.sql"));
      const rows = await client.query(
        `select title, reference_number from item_submission
         where legal_entity_id = $1 order by reference_number`,
        [entityId],
      );
      const [first, second] = rows.rows as { title: string; reference_number: string }[];
      expect(first?.title).toBe("Earlier");
      expect(Number(second?.reference_number)).toBe(Number(first?.reference_number) + 1);
      const next = await client.query(
        `insert into item_submission (legal_entity_id, title) values ($1, 'New')
         returning reference_number`,
        [entityId],
      );
      const max = await client.query("select max(reference_number) as m from item_submission");
      expect(Number(next.rows[0].reference_number)).toBe(Number(max.rows[0].m));
    });

    it("stores the 14-day choose-by date for lots already unsold", async () => {
      const { lotId } = await seed();
      await client.query(read("0258_workspace_selling_modules.sql"));
      const row = await client.query(
        "select choose_by from unsold_choice_deadline where lot_id = $1",
        [lotId],
      );
      expect(new Date(row.rows[0].choose_by).toISOString()).toBe("2026-11-15T18:00:00.000Z");
    });

    it("rolls back cleanly", async () => {
      await seed();
      await client.query(read("0258_workspace_selling_modules.sql"));
      await client.query(read("0258_rollback.sql"));
      const table = await client.query("select to_regclass('unsold_choice_deadline') as t");
      expect(table.rows[0].t).toBeNull();
      const column = await client.query(
        `select 1 from information_schema.columns
         where table_name = 'item_submission' and column_name = 'reference_number'`,
      );
      expect(column.rowCount).toBe(0);
    });
  },
);
