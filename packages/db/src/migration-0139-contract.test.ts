import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUYER_INTEREST_CATEGORY_SEEDS } from "@auction/validators";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const partial = readFileSync(
  join(__dirname, "../drizzle/0138_buyer_interest_categories.sql"),
  "utf8",
);
const complete = readFileSync(
  join(__dirname, "../drizzle/0139_complete_buyer_interest_categories.sql"),
  "utf8",
);
const rollback = readFileSync(join(__dirname, "../drizzle/0139_rollback.sql"), "utf8");

const seedSlugs = Object.values(BUYER_INTEREST_CATEGORY_SEEDS).map(({ slug }) => slug);

describe("migration 0139 complete buyer interest categories contract", () => {
  it("seeds the full canonical catalog without mutating existing rows", () => {
    expect(complete).toContain("ON CONFLICT DO NOTHING");
    expect(complete).not.toContain("DO UPDATE");
    expect(complete).not.toContain('"archived" = false');
    for (const slug of seedSlugs) {
      expect(complete).toContain(`'${slug}'`);
    }
  });

  it("aligns 0138 plus 0139 with the shared seed contract", () => {
    const combined = `${partial}\n${complete}`;
    for (const seed of Object.values(BUYER_INTEREST_CATEGORY_SEEDS)) {
      expect(combined).toContain(seed.id);
      expect(combined).toContain(`'${seed.slug}'`);
    }
    expect(seedSlugs).toHaveLength(8);
  });

  it("keeps rollback non-destructive", () => {
    expect(rollback).toMatch(/Intentionally non-destructive/i);
    expect(rollback).not.toMatch(/\bDELETE\b/i);
    expect(rollback).not.toMatch(/\bUPDATE\b/i);
    expect(rollback).not.toMatch(/\bTRUNCATE\b/i);
    expect(rollback).not.toMatch(/\bDROP\b/i);
  });
});
