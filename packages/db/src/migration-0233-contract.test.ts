import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");
const FORWARD = "0233_shop_order_reference_and_progress.sql";

describe("migration 0233 order references and fulfilment progress", () => {
  it("numbers existing orders before the column becomes required, then issues references from a sequence", async () => {
    const forward = await readFile(resolve(drizzle, FORWARD), "utf8");
    expect(forward).toContain("lock_timeout");
    const added = forward.indexOf(`ADD COLUMN IF NOT EXISTS "reference" text;`);
    const backfilled = forward.indexOf(`SET "reference" = 'LAX-S-'`);
    const defaulted = forward.indexOf(`ALTER COLUMN "reference" SET DEFAULT`);
    const required = forward.indexOf(`ALTER COLUMN "reference" SET NOT NULL`);
    expect(added).toBeGreaterThan(-1);
    expect(backfilled).toBeGreaterThan(added);
    expect(defaulted).toBeGreaterThan(backfilled);
    expect(required).toBeGreaterThan(defaulted);
    expect(forward).toContain(`nextval('shop_order_reference_seq')`);
    expect(forward).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_reference_uid"`);
    // Creation order decides the numbers, so the first order placed has the lowest one.
    expect(forward).toContain(`row_number() OVER (ORDER BY "created_at", "id")`);
  });

  it("adds only nullable stage dates to fulfilment, so an older shop-api keeps writing it", async () => {
    const forward = await readFile(resolve(drizzle, FORWARD), "utf8");
    for (const column of [
      "production_started_at",
      "dispatched_at",
      "ready_for_collection_at",
      "cancelled_at",
    ]) {
      expect(forward).toContain(
        `ALTER TABLE "shop_fulfilment" ADD COLUMN IF NOT EXISTS "${column}" timestamp with time zone;`,
      );
    }
    expect(forward).toContain(`ADD VALUE IF NOT EXISTS 'order_problem'`);
  });

  it("rolls back the columns, index and sequence", async () => {
    const rollback = await readFile(resolve(drizzle, "0233_rollback.sql"), "utf8");
    expect(rollback).toContain(`ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "reference";`);
    expect(rollback).toContain(`DROP INDEX IF EXISTS "shop_order_reference_uid";`);
    expect(rollback).toContain(`DROP SEQUENCE IF EXISTS "shop_order_reference_seq";`);
    expect(rollback).toContain(
      `ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "dispatched_at";`,
    );
  });

  it("is in the journal after 0232", async () => {
    const journal = JSON.parse(await readFile(resolve(drizzle, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const tags = journal.entries.map((entry) => entry.tag);
    const at = tags.indexOf("0233_shop_order_reference_and_progress");
    expect(at).toBeGreaterThan(tags.indexOf("0232_shop_sale_authority_decline_reason"));
    expect(journal.entries[at]?.when).toBeGreaterThan(journal.entries[at - 1]?.when ?? 0);
  });
});
