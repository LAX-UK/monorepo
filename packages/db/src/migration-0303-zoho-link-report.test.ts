import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0303_zoho_link_report.sql");
const rollback = read("0303_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0303 link lax.art originals to Zoho", () => {
  it("is journalled after the previous migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0303_zoho_link_report");
    const previous = journal.entries.find((e) => e.tag === "0302_lax_art_draft_from_register");
    expect(entry?.idx).toBe(303);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("adds the link and unlink event types and a switch that starts off", () => {
    expect(migration).toMatch(/'zoho_link_linked', 'zoho_link_unlinked'/);
    expect(migration).toMatch(/"enabled" boolean NOT NULL DEFAULT false/);
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
  });

  it("rolls back only when no link event exists, then restores the narrower check", () => {
    const guard = rollback.indexOf("zoho_link_linked");
    const restore = rollback.indexOf("ADD CONSTRAINT");
    expect(guard).toBeGreaterThan(-1);
    expect(restore).toBeGreaterThan(guard);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_catalogue_setting"/);
  });
});
