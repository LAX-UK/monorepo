import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(__dirname, "../drizzle/0138_buyer_interest_categories.sql"),
  "utf8",
);
const rollback = readFileSync(join(__dirname, "../drizzle/0138_rollback.sql"), "utf8");

describe("migration 0138 buyer interest categories contract", () => {
  it.each(["jewellery", "antiques", "memorabilia"])(
    "creates the %s category without mutating existing rows",
    (slug) => {
      expect(migration).toContain(`'${slug}'`);
      expect(migration).toContain("ON CONFLICT DO NOTHING");
      expect(migration).not.toContain("DO UPDATE");
      expect(migration).not.toContain('"archived" = false');
    },
  );

  it("rolls back only migration-owned id and slug pairs", () => {
    expect(rollback).toContain('("id", "slug") IN');
    expect(rollback).toContain("'jewellery'");
    expect(rollback).toContain("'antiques'");
    expect(rollback).toContain("'memorabilia'");
  });
});
