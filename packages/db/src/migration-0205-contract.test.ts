import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { API_DENY_TABLES, AUTH_POLICY_TABLES, AUTH_READ_TABLES } from "./migrate-roles.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

const definerFunctions = [
  "identity_access_marker_sync_staff(text, text, boolean)",
  "identity_access_marker_from_bid_profile()",
  "identity_access_marker_from_shop_staff()",
  "identity_access_marker_sync_org(text, uuid)",
  "identity_access_marker_from_org_member()",
];

describe("migration 0205 contract", () => {
  it("keeps access markers in sync from every product role table", async () => {
    const forward = await readFile(resolve(drizzle, "0205_identity_access_policy.sql"), "utf8");

    expect(forward).toMatch(
      /AFTER INSERT OR DELETE OR UPDATE OF "role" ON public\."bid_user_profile"/,
    );
    expect(forward).toMatch(
      /AFTER INSERT OR DELETE OR UPDATE OF "identity_subject_id", "disabled_at" ON public\."shop_staff_member"/,
    );
    expect(forward).toMatch(
      /AFTER INSERT OR DELETE OR UPDATE OF "user_id", "legal_entity_id", "accepted_at", "removed_at"\s+ON public\."legal_entity_member"/,
    );
    expect(forward).toContain(`e."kind" = 'organisation'`);
  });

  it("pins definer functions to a safe search_path and revokes public execute", async () => {
    const forward = await readFile(resolve(drizzle, "0205_identity_access_policy.sql"), "utf8");
    const definers = forward.match(/SECURITY DEFINER\nSET search_path = pg_catalog, public/g) ?? [];

    expect(definers).toHaveLength(definerFunctions.length);
    for (const fn of definerFunctions) {
      expect(forward).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC;`);
    }
  });

  it("seeds the staff policy as required and rolls back every object", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0205_identity_access_policy.sql"), "utf8"),
      readFile(resolve(drizzle, "0205_rollback.sql"), "utf8"),
    ]);

    expect(forward).toMatch(
      /INSERT INTO "identity_mfa_policy" \("scope", "required"\)\nVALUES \('staff', true\)/,
    );
    for (const table of [...AUTH_READ_TABLES, ...AUTH_POLICY_TABLES]) {
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
      expect([...API_DENY_TABLES]).toContain(table);
    }
    expect(rollback).toContain(`DROP COLUMN IF EXISTS "social_auth_at"`);
  });
});
