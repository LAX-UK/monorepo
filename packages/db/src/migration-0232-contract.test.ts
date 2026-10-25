import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0232 sale limit request decline reason", () => {
  it("adds one nullable column so an older shop-api keeps reading and writing requests", async () => {
    const forward = await readFile(
      resolve(drizzle, "0232_shop_sale_authority_decline_reason.sql"),
      "utf8",
    );
    expect(forward).toContain("lock_timeout");
    expect(forward).toContain(
      `ALTER TABLE "shop_sale_authority_request" ADD COLUMN IF NOT EXISTS "decline_reason" text;`,
    );
    expect(forward).not.toMatch(/\bDROP\b/i);
    expect(forward).not.toMatch(/\bNOT\s+NULL\b/i);
  });

  it("rolls back by dropping the column", async () => {
    const rollback = await readFile(resolve(drizzle, "0232_rollback.sql"), "utf8");
    expect(rollback).toContain(
      `ALTER TABLE "shop_sale_authority_request" DROP COLUMN IF EXISTS "decline_reason";`,
    );
  });

  it("is in the journal after 0231", async () => {
    const journal = JSON.parse(await readFile(resolve(drizzle, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const tags = journal.entries.map((entry) => entry.tag);
    const at = tags.indexOf("0232_shop_sale_authority_decline_reason");
    expect(at).toBeGreaterThan(tags.indexOf("0231_shop_edition_alerts"));
    const previous = journal.entries[at - 1];
    expect(journal.entries[at]?.when).toBeGreaterThan(previous?.when ?? 0);
  });
});
