import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0158 contract", () => {
  it("revokes and can restore the staged API user-table read", async () => {
    const [forward, rollback, roles] = await Promise.all([
      readFile(resolve(drizzle, "0158_revoke_api_user_reads.sql"), "utf8"),
      readFile(resolve(drizzle, "0158_rollback.sql"), "utf8"),
      readFile(resolve(import.meta.dirname, "migrate-roles.ts"), "utf8"),
    ]);

    expect(forward).toContain('REVOKE SELECT ON TABLE public."user" FROM api_app');
    expect(rollback).toContain('GRANT SELECT ON TABLE public."user" TO api_app');
    expect(roles).toContain("const restoreApiUserSelect = await hasTablePrivilege(");
    expect(roles).toContain('await grantIfExists(client, "api_app", "user", "SELECT")');
    expect(roles).not.toMatch(/API_(?:READ|DENY)_TABLES\s*=\s*\[[^\]]*["']user["']/s);
  });
});
