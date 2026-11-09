import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0340_shop_delivery_quote_carrier.sql");
const rollback = read("0340_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0340 shop delivery quote carrier", () => {
  it("follows 0332 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0340_shop_delivery_quote_carrier");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0338_shop_framing_on_editions");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds two nullable columns and a rule, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b|\bNOT NULL\b/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "quoted_carrier" text/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "decline_note" text/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("makes a priced quote name its carrier", () => {
    expect(migration).toContain(
      `"status" NOT IN ('quoted', 'accepted') OR length(btrim("quoted_carrier")) > 0`,
    );
  });

  it("has a rollback that drops the rule and both columns", () => {
    expect(rollback).toMatch(/DROP CONSTRAINT IF EXISTS "shop_delivery_quote_carrier_check"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "decline_note"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "quoted_carrier"/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
