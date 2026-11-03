import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const migration = read("0290_alert_followers.sql");
const rollback = read("0290_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0290 alert followers", () => {
  it("is journal entry 290, dated after 0285", () => {
    const entry = journal.entries.find((e) => e.tag === "0290_alert_followers");
    const previous = journal.entries.find((e) => e.tag === "0285_shop_returns_stock");
    expect(entry?.idx).toBe(290);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("switches on the artist and search topics for verified accounts that follow or save", () => {
    expect(migration).toContain("'bid.artists', true");
    expect(migration).toContain("'bid.searches', true");
    expect(migration).toContain('FROM "artist_watchlist" w');
    expect(migration).toContain('ss."notify_email"');
    expect(migration).toContain('d."email_verified"');
  });

  it("never overrides a row that exists", () => {
    expect(migration.match(/ON CONFLICT/g)?.length).toBe(3);
    expect(migration).toContain('ON CONFLICT ("subscriber_id", "topic") DO NOTHING');
    expect(migration).toContain("x.\"status\" = 'confirmed'");
  });

  it("only removes what it created when rolled back", () => {
    expect(rollback).toContain(`"changed_by" = 'migration'`);
    expect(rollback).not.toMatch(/DROP TABLE/);
  });
});
