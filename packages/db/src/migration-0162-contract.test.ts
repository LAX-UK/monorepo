import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0162 contract", () => {
  it("enables only registered browser RPs and can remove the capability", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0162_enable_oidc_end_session.sql"), "utf8"),
      readFile(resolve(drizzle, "0162_rollback.sql"), "utf8"),
    ]);

    expect(forward).toContain(
      'ADD COLUMN IF NOT EXISTS "enable_end_session" boolean NOT NULL DEFAULT false',
    );
    expect(forward).toContain("'lax-bid-web', 'lax-shop-web'");
    expect(rollback).toContain('DROP COLUMN IF EXISTS "enable_end_session"');
  });
});
