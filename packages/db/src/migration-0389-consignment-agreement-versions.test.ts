import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { consignmentAgreement } from "./schema/consignment-agreements.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0389_consignment_agreement_versions";
const migration = read(`${TAG}.sql`);
const rollback = read("0389_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0389 consignment agreement versions (files)", () => {
  it("is journalled right after 0388, in a journal that stays ordered", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    const previous = journal.entries[at - 1];
    expect(previous?.tag).toBe("0388_accounting_shop_refunds");
    expect(journal.entries[at]?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    const times = journal.entries.map((e) => e.when);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1] ?? Number.POSITIVE_INFINITY);
    }
  });

  it("adds the columns idempotently, existing rows as current version 1", () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL');
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "superseded_at" timestamp with time zone,/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "superseded_by" uuid;/);
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
  });

  it("keeps one current version per consignment under the index's old name", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "consignment_agreement_submission_id_uidx"\s+ON "consignment_agreement" \("submission_id"\) WHERE "superseded_at" IS NULL;/,
    );
    expect(migration).toContain('"consignment_agreement_submission_version_uidx"');
    expect(migration).toMatch(/FOREIGN KEY \("superseded_by"\)[^;]*DEFERRABLE INITIALLY DEFERRED;/);
  });

  it("freezes a superseded version, and the rollback removes the guard", () => {
    expect(migration).toContain('CREATE TRIGGER "consignment_agreement_superseded_frozen"');
    expect(migration).toMatch(/IF OLD\."superseded_at" IS NULL THEN\s+RETURN NEW;/);
    for (const column of [
      "commission_percent",
      "accepted_at",
      "signed_document_id",
      "replaces_agreement_id",
      "version",
    ]) {
      expect(migration).toContain(`NEW."${column}"`);
    }
    expect(rollback).toContain('DROP TRIGGER IF EXISTS "consignment_agreement_superseded_frozen"');
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS "consignment_agreement_superseded_frozen"()',
    );
  });

  it("rolls back in one transaction, refusing while a version is superseded, and clears its ledger row", () => {
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
    expect(rollback).toMatch(/"superseded_at" IS NOT NULL;\s+IF superseded > 0 THEN\s+RAISE/);
    expect(rollback).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "consignment_agreement_submission_id_uidx"\s+ON "consignment_agreement" USING btree \("submission_id"\);/,
    );
    for (const column of ["version", "superseded_at", "superseded_by"]) {
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${when};`,
    );
  });

  it("is the shape the schema reads", () => {
    expect(consignmentAgreement.version.name).toBe("version");
    expect(consignmentAgreement.supersededAt.name).toBe("superseded_at");
    expect(consignmentAgreement.supersededBy.name).toBe("superseded_by");
  });
});
