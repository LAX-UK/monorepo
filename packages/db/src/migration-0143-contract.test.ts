import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const forward = readFileSync(
  join(__dirname, "../drizzle/0143_oauth_consent_client_user_unique.sql"),
  "utf8",
);
const rollback = readFileSync(join(__dirname, "../drizzle/0143_rollback.sql"), "utf8");

describe("migration 0143 oauth consent uniqueness contract", () => {
  it("locks writes and merges every duplicate grant before creating the index", () => {
    expect(forward).toContain('LOCK TABLE "oauth_consent" IN SHARE ROW EXCLUSIVE MODE');
    expect(forward).toContain('PARTITION BY "client_id", "user_id"');
    expect(forward).toContain('ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC');
    expect(forward).toContain("jsonb_agg(DISTINCT scope ORDER BY scope)");
    expect(forward).toContain('ranked."consent_given" AS merged_consent_given');
    expect(forward).not.toContain('bool_or(consent."consent_given")');
    expect(forward).toContain("RAISE NOTICE 'migration 0143: merging % oauth_consent");

    const mergePosition = forward.indexOf('UPDATE "oauth_consent"');
    const cleanupPosition = forward.indexOf('DELETE FROM "oauth_consent"');
    const indexPosition = forward.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS "oauth_consent_client_user_uidx"',
    );
    expect(mergePosition).toBeGreaterThanOrEqual(0);
    expect(cleanupPosition).toBeGreaterThan(mergePosition);
    expect(cleanupPosition).toBeGreaterThanOrEqual(0);
    expect(indexPosition).toBeGreaterThan(cleanupPosition);
  });

  it("drops the uniqueness guard on rollback", () => {
    expect(rollback).toContain('DROP INDEX IF EXISTS "oauth_consent_client_user_uidx"');
  });
});
