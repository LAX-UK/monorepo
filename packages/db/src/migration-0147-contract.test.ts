import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0147 contract", () => {
  it("removes Shop session id_token storage with a reversible rollback", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0147_remove_shop_session_id_token.sql"), "utf8"),
      readFile(resolve(drizzle, "0147_rollback.sql"), "utf8"),
    ]);

    expect(forward).toContain('ALTER TABLE "shop_identity_session" DROP COLUMN "id_token"');
    expect(rollback).toContain('ALTER TABLE "shop_identity_session" ADD COLUMN "id_token" text');
  });
});
