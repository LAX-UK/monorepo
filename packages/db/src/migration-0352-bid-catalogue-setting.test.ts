import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0352_bid_catalogue_setting.sql");
const rollback = read("0352_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0352 Bid catalogue setting", () => {
  it("is journalled one day after the previous migration", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0352_bid_catalogue_setting");
    expect(index).toBeGreaterThan(0);
    expect(journal.entries[index]?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(journal.entries[index]?.when).toBe((journal.entries[index - 1]?.when ?? 0) + 86_400_000);
  });

  it("adds a switch table that starts empty, so every switch is off", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "bid_catalogue_setting"/);
    expect(migration).toMatch(/"enabled" boolean NOT NULL DEFAULT false/);
    expect(migration).not.toMatch(/\bINSERT\b|\bDROP\b/);
  });

  it("rolls back by dropping the table", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "bid_catalogue_setting"/);
  });
});
