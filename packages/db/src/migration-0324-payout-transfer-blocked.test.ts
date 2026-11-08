import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { payoutStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0324_payout_transfer_blocked.sql");
const rollback = read("0324_rollback.sql");
const schema = readFileSync(join(__dirname, "schema/payouts.ts"), "utf8");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const listed = (sql: string): string[] => {
  const match = sql.match(/"status" IN \(([^)]*)\)/);
  return [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
};

describe("migration 0324 payout transfer blocked", () => {
  it("is a journal entry after the one before it, in order", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0324_payout_transfer_blocked");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("widens the status check to exactly the app's statuses, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/NOT VALID;/);
    expect(migration).toMatch(/VALIDATE CONSTRAINT "payout_status_check"/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)/);
    expect([...listed(migration)].sort()).toEqual([...payoutStatuses].sort());
    expect(payoutStatuses).toContain("transfer_blocked");
  });

  it("matches the schema check", () => {
    const schemaList = [
      ...(schema.match(/"payout_status_check",\s*sql`[^`]*IN \(([^)]*)\)/)?.[1] ?? "").matchAll(
        /'([a-z_]+)'/g,
      ),
    ].map((m) => m[1]);
    expect([...schemaList].sort()).toEqual([...payoutStatuses].sort());
  });

  it("rolls back by moving blocked rows to failed, with the reason prefixed, before narrowing", () => {
    const update = rollback.indexOf('UPDATE "payout"');
    const narrow = rollback.indexOf('ADD CONSTRAINT "payout_status_check"');
    expect(update).toBeGreaterThanOrEqual(0);
    expect(narrow).toBeGreaterThan(update);
    expect(rollback).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(rollback).toMatch(/"status" = 'failed'/);
    expect(rollback).toMatch(
      /'rolled_back_from_transfer_blocked: ' \|\| COALESCE\("failure_reason"/,
    );
    expect(rollback).toMatch(/WHERE "status" = 'transfer_blocked'/);
    expect(listed(rollback)).not.toContain("transfer_blocked");
    expect(listed(rollback)).toContain("clawback_pending");
  });
});
