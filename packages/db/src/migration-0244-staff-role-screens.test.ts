import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { staffRoleAssignment } from "./schema/staff-role-assignment.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0244_staff_role_screens.sql");
const rollback = read("0244_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0244 staff role screens", () => {
  it("is journal entry 244", () => {
    const entry = journal.entries.find((e) => e.tag === "0244_staff_role_screens");
    expect(entry?.idx).toBe(244);
  });

  it("adds the end-recorded column the schema declares, and the rollback drops it", () => {
    const column = getTableColumns(staffRoleAssignment).endRecordedAt.name;
    expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
  });

  it("marks ends already past as recorded, so the expiry job tells nobody about them", () => {
    expect(migration).toMatch(
      /SET "end_recorded_at" = "ends_at"\s+WHERE "ends_at" IS NOT NULL AND "ends_at" <= now\(\)/,
    );
  });

  it("lets an invitation carry several roles per platform and the rollback keeps one", () => {
    expect(migration).toContain('PRIMARY KEY ("invitation_id", "product", "role")');
    expect(rollback).toContain('PRIMARY KEY ("invitation_id", "product")');
    // The invitation's primary Bid role is the one kept.
    expect(rollback).toContain('g."role" <> i."target_staff_role"::text');
  });

  it("allows the staff role expiry notifications and removes them on rollback", () => {
    expect(migration).toContain("'staff_role_expired',");
    expect(migration).toContain("'staff_role_expired_admin'");
    expect(rollback).toContain(
      "DELETE FROM notification WHERE type IN ('staff_role_expired', 'staff_role_expired_admin')",
    );
    expect(rollback).not.toContain("'staff_role_expired',\n");
  });
});
