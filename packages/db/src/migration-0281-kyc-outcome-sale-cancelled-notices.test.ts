import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0281_kyc_outcome_sale_cancelled_notices.sql");
const rollback = read("0281_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const NEW_TYPES = ["kyc_approved", "kyc_declined", "sale_cancelled"];

// Types added by later migrations; 0281's list ends at the last of its own.
const TYPES_AT_0281 = NOTIFICATION_TYPES.slice(0, NOTIFICATION_TYPES.indexOf("sale_cancelled") + 1);

const typesIn = (text: string) => {
  const at = text.lastIndexOf("ADD CONSTRAINT notification_type_check");
  return [...text.slice(at).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe("migration 0281 kyc outcome and sale cancelled notices", () => {
  it("is journal entry 281, after 0280", () => {
    const entry = journal.entries.find((e) => e.tag === "0281_kyc_outcome_sale_cancelled_notices");
    const previous = journal.entries.find((e) => e.tag === "0280_deletion_safety");
    expect(entry?.idx).toBe(281);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("allows exactly the types that existed at 0281", () => {
    expect(typesIn(migration)).toEqual(TYPES_AT_0281);
  });

  it("removes only the three new types on rollback, and restores the previous list", () => {
    expect(typesIn(rollback)).toEqual(TYPES_AT_0281.filter((t) => !NEW_TYPES.includes(t)));
    expect(rollback).toContain(
      "DELETE FROM notification WHERE type IN ('kyc_approved', 'kyc_declined', 'sale_cancelled')",
    );
  });
});
