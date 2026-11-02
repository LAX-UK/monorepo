import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0277_enquiry_workflow.sql");
const rollback = read("0277_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0277 enquiry workflow", () => {
  it("is journal entry 275, after 0274", () => {
    const entry = journal.entries.find((e) => e.tag === "0277_enquiry_workflow");
    const previous = journal.entries.find((e) => e.tag === "0274_marketing_enquiry");
    expect(entry?.idx).toBe(275);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("numbers enquiries from E-1001 in arrival order, from its own sequence, uniquely", () => {
    for (const fragment of [
      'CREATE SEQUENCE IF NOT EXISTS "marketing_enquiry_reference_seq" START WITH 1001',
      "ORDER BY created_at, id",
      "'E-' || nextval('marketing_enquiry_reference_seq')::text",
      'ALTER COLUMN "reference" SET NOT NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS "marketing_enquiry_reference_uidx"',
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("adds the workflow columns, with owners that clear when the user goes", () => {
    for (const column of [
      "\"intent\" text DEFAULT 'general' NOT NULL",
      '"close_reason" text',
      '"assigned_to_user_id" text',
      '"department_slug" text',
      '"user_id" text',
      '"legal_entity_id" uuid',
      '"marketing_opt_in" boolean DEFAULT false NOT NULL',
      '"version" integer DEFAULT 1 NOT NULL',
    ]) {
      expect(migration).toContain(column);
    }
    for (const fk of [
      "marketing_enquiry_assigned_to_user_id_user_id_fk",
      "marketing_enquiry_user_id_user_id_fk",
      "marketing_enquiry_legal_entity_id_legal_entity_id_fk",
    ]) {
      const statement = migration.slice(migration.indexOf(`CONSTRAINT "${fk}"`));
      expect(statement.slice(0, statement.indexOf("ON DELETE set null"))).toContain("FOREIGN KEY");
    }
  });

  it("widens the status, turns handled into closed and reads the intent from the message tag", () => {
    expect(migration).toContain(
      "CHECK (\"status\" IN ('new', 'in_progress', 'waiting_on_client', 'converted', 'closed'))",
    );
    expect(migration).toContain(
      'UPDATE "marketing_enquiry" SET "status" = \'closed\' WHERE "status" = \'handled\'',
    );
    expect(migration).toContain(
      "WHEN \"message\" LIKE 'Private sale enquiry%' AND \"topic\" = 'selling' THEN 'private_sale_sell'",
    );
    expect(migration).toContain(
      "WHEN \"message\" LIKE 'Private sale enquiry%' THEN 'private_sale_buy'",
    );
    expect(migration).toContain('CHECK (("status" = \'closed\') = ("handled_at" IS NOT NULL))');
  });

  it("creates the detail, attachment, note, message and routing tables", () => {
    for (const table of [
      "private_sale_enquiry_detail",
      "marketing_enquiry_attachment",
      "marketing_enquiry_note",
      "marketing_enquiry_message",
      "enquiry_routing_rule",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
    expect(migration).toContain('"enquiry_routing_rule_fallback_uidx"');
  });

  it("rolls the statuses and columns back to the original shape", () => {
    expect(rollback).toContain("CASE WHEN \"status\" = 'closed' THEN 'handled' ELSE 'new' END");
    expect(rollback).toContain('DROP COLUMN IF EXISTS "reference"');
    expect(rollback).toContain("CHECK (\"status\" IN ('new', 'handled'))");
    expect(rollback.startsWith("--")).toBe(true);
    expect(migration.startsWith("--")).toBe(true);
    expect(migration).toContain("SET LOCAL lock_timeout");
  });
});
