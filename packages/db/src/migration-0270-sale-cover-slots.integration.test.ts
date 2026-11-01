import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

async function run(pool: pg.Pool, fileName: string): Promise<void> {
  const sql = await readFile(resolve(import.meta.dirname, "../drizzle", fileName), "utf8");
  await pool.query(sql.replaceAll("--> statement-breakpoint", ""));
}

async function columns(pool: pg.Pool, table: string): Promise<string[]> {
  const result = await pool.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

describe.skipIf(!migrationUrl)("migration 0270 sale cover slots", () => {
  it("adds the cover columns with safe defaults, constrains them, and rolls back and re-applies", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);

      expect(await columns(pool, "sale")).toEqual(
        expect.arrayContaining([
          "cover_slots",
          "subtitle",
          "featured_lot_ids",
          "home_pin_order",
          "consignment_deadline",
        ]),
      );
      expect(await columns(pool, "lot")).toEqual(
        expect.arrayContaining(["photo_includes_frame", "framed_width_cm", "framed_height_cm"]),
      );

      const defaults = await pool.query<{ column_name: string; column_default: string }>(
        `SELECT column_name, column_default FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sale'
           AND column_name IN ('cover_slots', 'featured_lot_ids')`,
      );
      const byName = Object.fromEntries(
        defaults.rows.map((r) => [r.column_name, r.column_default]),
      );
      expect(byName.cover_slots).toContain("'{}'::jsonb");
      expect(byName.featured_lot_ids).toContain("'{}'");

      // The analysis table keeps a result only when it has one, and a failure only when it has none.
      const insert = (hash: string, status: string, analysis: string | null) =>
        pool.query(
          "INSERT INTO public.cover_analysis (hash, status, analysis) VALUES ($1, $2, $3::jsonb)",
          [hash, status, analysis],
        );
      await insert("a1", "ready", '{"version":1}');
      await insert("a2", "failed", null);
      await expect(insert("a3", "ready", null)).rejects.toMatchObject({ code: "23514" });
      await expect(insert("a4", "failed", '{"version":1}')).rejects.toMatchObject({
        code: "23514",
      });
      await expect(insert("a5", "pending", null)).rejects.toMatchObject({ code: "23514" });

      const constraints = await pool.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
         WHERE conname IN ('sale_subtitle_length', 'sale_featured_lot_ids_max',
                           'sale_home_pin_order_range', 'lot_framed_size_check')`,
      );
      expect(constraints.rowCount).toBe(4);
      const pinIndex = await pool.query(
        "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sale_home_pin_order_uid'",
      );
      expect(pinIndex.rowCount).toBe(1);

      await run(pool, "0270_rollback.sql");
      expect(await columns(pool, "sale")).not.toContain("cover_slots");
      expect(await columns(pool, "sale")).not.toContain("home_pin_order");
      expect(await columns(pool, "lot")).not.toContain("framed_width_cm");
      const gone = await pool.query("SELECT to_regclass('public.cover_analysis') AS analysis");
      expect(gone.rows[0]).toEqual({ analysis: null });

      await run(pool, "0270_sale_cover_slots.sql");
      expect(await columns(pool, "sale")).toContain("cover_slots");
      const back = await pool.query("SELECT to_regclass('public.cover_analysis') AS analysis");
      expect(back.rows[0]).toEqual({ analysis: "cover_analysis" });
    });
  });
});
