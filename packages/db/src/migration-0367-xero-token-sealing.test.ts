import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0367_xero_token_sealing.sql");
const rollback = read("0367_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0367 Xero token sealing", () => {
  it("is journalled once, with a unique idx and a timestamp later than the entry before it", () => {
    const matches = journal.entries.filter((e) => e.tag === "0367_xero_token_sealing");
    expect(matches).toHaveLength(1);
    const entry = matches[0];
    if (!entry) throw new Error("journal entry missing");
    expect(entry.when).toBe(1806739200000);
    expect(journal.entries.filter((e) => e.idx === entry.idx)).toHaveLength(1);
    const position = journal.entries.indexOf(entry);
    const previous = journal.entries[position - 1];
    expect(previous).toBeDefined();
    expect(entry.idx).toBeGreaterThan(previous?.idx ?? Number.POSITIVE_INFINITY);
    expect(entry.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("requires the sealed columns to hold an envelope", () => {
    expect(migration).toMatch(/"access_token_sealed" IS NULL OR "access_token_sealed" LIKE 'v1:%'/);
    expect(migration).toMatch(
      /"refresh_token_sealed" IS NULL OR "refresh_token_sealed" LIKE 'v1:%'/,
    );
  });

  it("adds nullable sealed columns and relaxes the plaintext ones, without touching rows", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "access_token_sealed" text;/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "refresh_token_sealed" text;/);
    expect(migration).toMatch(/"access_token" DROP NOT NULL/);
    expect(migration).toMatch(/"refresh_token" DROP NOT NULL/);
    expect(migration).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP COLUMN\b/);
  });

  it("rolls back without losing a connection, forcing a reconnect where tokens were sealed", () => {
    expect(rollback).toMatch(/'needs_reauth'/);
    expect(rollback).toMatch(/SET NOT NULL/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "access_token_sealed"/);
    expect(rollback).not.toMatch(/\bDELETE\b/);
  });
});
