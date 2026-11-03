import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0278_enquiry_draft_uploads.sql");
const rollback = read("0278_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0278 enquiry draft uploads", () => {
  it("is journal entry 278, after 0277", () => {
    const entry = journal.entries.find((e) => e.tag === "0278_enquiry_draft_uploads");
    const previous = journal.entries.find((e) => e.tag === "0277_enquiry_workflow");
    expect(entry?.idx).toBe(278);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("lets a file belong to an enquiry draft, with exactly one owner", () => {
    for (const fragment of [
      'ALTER COLUMN "owner_user_id" DROP NOT NULL',
      'ADD COLUMN IF NOT EXISTS "enquiry_draft_id" uuid',
      'CHECK (num_nonnulls("owner_user_id", "enquiry_draft_id") = 1)',
      'CREATE INDEX IF NOT EXISTS "upload_object_enquiry_draft_idx"',
      'CREATE INDEX IF NOT EXISTS "upload_object_enquiry_expiry_idx"',
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("rolls back by removing draft files first, then restoring the user owner", () => {
    const order = [
      'DELETE FROM "upload_object" WHERE "enquiry_draft_id" IS NOT NULL',
      'DROP CONSTRAINT IF EXISTS "upload_object_single_owner_check"',
      'DROP COLUMN IF EXISTS "enquiry_draft_id"',
      'ALTER COLUMN "owner_user_id" SET NOT NULL',
    ].map((fragment) => rollback.indexOf(fragment));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
