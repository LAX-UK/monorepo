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
  it("is journalled with a timestamp later than every other entry", () => {
    const entry = journal.entries.find((e) => e.tag === "0367_xero_token_sealing");
    expect(entry?.when).toBe(1806739200000);
    for (const other of journal.entries) {
      if (other !== entry) expect(entry?.when).toBeGreaterThan(other.when);
    }
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
