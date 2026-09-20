import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0176 contract", () => {
  it("adds encrypted OIDC token columns with a reversible rollback", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0176_shop_session_oidc_tokens.sql"), "utf8"),
      readFile(resolve(drizzle, "0176_rollback.sql"), "utf8"),
    ]);

    expect(forward).toContain('"id_token_encrypted"');
    expect(forward).toContain('"refresh_token_encrypted"');
    expect(forward).toContain('"refresh_expires_at"');
    expect(rollback).toContain('DROP COLUMN "id_token_encrypted"');
    expect(rollback).toContain('DROP COLUMN "refresh_token_encrypted"');
    expect(rollback).toContain('DROP COLUMN "refresh_expires_at"');
  });
});
