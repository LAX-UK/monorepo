import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUYER_INTEREST_CATEGORY_SEEDS } from "@auction/validators";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration0130 = readFileSync(
  join(__dirname, "../drizzle/0130_buyer_interest_categories.sql"),
  "utf8",
);
const migration0131 = readFileSync(
  join(__dirname, "../drizzle/0131_complete_buyer_interest_categories.sql"),
  "utf8",
);
const rollback0131 = readFileSync(join(__dirname, "../drizzle/0131_rollback.sql"), "utf8");

function insertedSlugs(sql: string): string[] {
  return [...sql.matchAll(/,\s*'([^']+)'\s*,\s*\d+\s*\)/g)].map((match) => match[1] ?? "");
}

describe("migration 0131 complete buyer interest category contract", () => {
  const seeds = Object.values(BUYER_INTEREST_CATEGORY_SEEDS);

  it("keeps migrations 0130 and 0131 aligned with exactly the canonical eight slugs", () => {
    const migratedSlugs = new Set([
      ...insertedSlugs(migration0130),
      ...insertedSlugs(migration0131),
    ]);

    expect(migratedSlugs).toEqual(new Set(seeds.map(({ slug }) => slug)));
  });

  it("uses stable IDs and preserves every pre-existing category row", () => {
    for (const { id, slug } of seeds) {
      expect(migration0131).toContain(`'${id}'`);
      expect(migration0131).toContain(`'${slug}'`);
    }
    expect(migration0131).toContain("ON CONFLICT DO NOTHING");
    expect(migration0131).not.toContain("DO UPDATE");
    expect(migration0131).not.toContain('"archived" = false');
  });

  it("uses an intentionally non-destructive rollback", () => {
    expect(rollback0131).toContain("Intentionally non-destructive");
    expect(rollback0131).not.toMatch(/\b(?:DELETE|UPDATE|TRUNCATE)\b/i);
  });
});
