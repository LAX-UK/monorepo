import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0148 contract", () => {
  it("adds durable issuer delivery and Shop session/replay storage with rollback", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0148_oidc_logout_and_shop_sessions.sql"), "utf8"),
      readFile(resolve(drizzle, "0148_rollback.sql"), "utf8"),
    ]);
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "oidc_backchannel_logout_delivery"');
    expect(forward).toContain('"event_key" text NOT NULL UNIQUE');
    expect(forward).toContain('"token_jti" text NOT NULL');
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "shop_identity_session"');
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "shop_logout_token_replay"');
    expect(forward).not.toMatch(/CREATE (?:UNIQUE )?INDEX "/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_logout_token_replay"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_identity_session"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "oidc_backchannel_logout_delivery"');
    expect(rollback.indexOf('"shop_logout_token_replay"')).toBeLessThan(
      rollback.indexOf('"shop_identity_session"'),
    );
    expect(rollback.indexOf('"shop_identity_session"')).toBeLessThan(
      rollback.indexOf('"oidc_backchannel_logout_delivery"'),
    );
  });
});
