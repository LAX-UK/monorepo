import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0282_buyer_default.sql");
const rollback = read("0282_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const NEW_TYPES = ["payment_reminder", "buyer_default_notice"];

const typesIn = (text: string) => {
  const at = text.lastIndexOf("ADD CONSTRAINT notification_type_check");
  return [...text.slice(at).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe("migration 0282 buyer default and payment reminders", () => {
  it("is journal entry 282, after 0281", () => {
    const entry = journal.entries.find((e) => e.tag === "0282_buyer_default");
    const previous = journal.entries.find(
      (e) => e.tag === "0281_kyc_outcome_sale_cancelled_notices",
    );
    expect(entry?.idx).toBe(282);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  // Types added by later migrations are not part of what 0282 allowed.
  const asOf0282 = NOTIFICATION_TYPES.filter((t) => !["sale_announced"].includes(t));

  it("allows exactly the types the schema listed then, including those from 0281", () => {
    expect(typesIn(migration)).toEqual(asOf0282);
  });

  it("removes only the two new types on rollback and restores the 0281 list", () => {
    expect(typesIn(rollback)).toEqual(asOf0282.filter((t) => !NEW_TYPES.includes(t)));
    expect(rollback).toContain("'sale_cancelled'");
    expect(rollback).toContain(
      "DELETE FROM notification WHERE type IN ('payment_reminder', 'buyer_default_notice')",
    );
  });

  it("creates the buyer default and reminder tables and drops them on rollback", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "buyer_default"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "payment_reminder"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "buyer_default"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "payment_reminder"');
  });
});
