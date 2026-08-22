import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(__dirname, "../drizzle/0130_buyer_interest_categories.sql"),
  "utf8",
);
const rollback = readFileSync(join(__dirname, "../drizzle/0130_rollback.sql"), "utf8");

describe("migration 0130 buyer interest categories contract", () => {
  it.each(["jewellery", "antiques", "memorabilia"])(
    "creates the %s category idempotently",
    (slug) => {
      expect(migration).toContain(`'${slug}'`);
      expect(migration).toContain("ON CONFLICT DO NOTHING");
      expect(rollback).toContain(`'${slug}'`);
    },
  );

  it("does not mutate a pre-existing category that owns one of the slugs", () => {
    expect(migration).not.toContain("DO UPDATE");
    expect(migration).not.toContain('"archived" = false');
  });

  it("limits rollback deletion to the expected id and slug pairs", () => {
    expect(rollback).toContain('WHERE ("id", "slug") IN');
    expect(rollback).toContain("('c1000017-0000-4000-8000-000000000017', 'jewellery')");
  });
});
