import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0144 contract", () => {
  it("is rerunnable and rolls back every added table and column", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0144_oidc_rp_sessions.sql"), "utf8"),
      readFile(resolve(drizzle, "0144_rollback.sql"), "utf8"),
    ]);

    expect(forward.match(/ADD COLUMN IF NOT EXISTS/g)).toHaveLength(4);
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "oidc_rp_session"');
    expect(forward).not.toMatch(/CREATE (?:UNIQUE )?INDEX "/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "oidc_rp_session"');
    expect(rollback.match(/DROP COLUMN IF EXISTS/g)).toHaveLength(4);
    expect(rollback.indexOf('DROP TABLE IF EXISTS "oidc_rp_session"')).toBeLessThan(
      rollback.indexOf('DROP COLUMN IF EXISTS "last_step_up_at"'),
    );
  });
});
