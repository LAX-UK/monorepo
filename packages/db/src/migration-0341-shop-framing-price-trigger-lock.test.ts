import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0341_shop_framing_price_trigger_lock.sql");
const rollback = read("0341_rollback.sql");
const original = read("0331_shop_framing_catalogue.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const functionOf = (sql: string) =>
  sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION "shop_framing_no_placeholder_offer"'),
    sql.indexOf("$$;", sql.indexOf("RETURNS trigger")) + 3,
  );

describe("migration 0341 shop framing price trigger lock", () => {
  it("follows 0336 in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex(
      (e) => e.tag === "0341_shop_framing_price_trigger_lock",
    );
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toMatch(/^0336_/);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("locks the option row whatever its status, then reads the status", () => {
    const body = functionOf(migration);
    // A lock inside a filter on 'active' would never lock a draft, which is the row that goes live.
    expect(body).toMatch(
      /SELECT o\."status" INTO v_status FROM "shop_framing_option" o WHERE o\."id" = NEW\."option_id" FOR UPDATE;/,
    );
    expect(body).not.toMatch(/o\."status" = 'active'/);
    expect(body).toMatch(/IF v_status = 'active' THEN/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("changes only the function: no tables, no triggers, no data", () => {
    const code = migration.replace(/^\s*--.*$/gm, "").replace(/FOR UPDATE/g, "");
    expect(code).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|CREATE TABLE|CREATE TRIGGER)\b/);
    expect(code.match(/CREATE OR REPLACE FUNCTION/g)?.length).toBe(1);
  });

  it("is undone by putting back the 0331 function", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/lock_timeout = '5s'/);
    expect(functionOf(rollback)).toBe(functionOf(original));
    expect(functionOf(rollback)).not.toContain("FOR UPDATE");
  });
});
