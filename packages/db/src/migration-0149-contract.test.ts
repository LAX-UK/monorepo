import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0149 contract", () => {
  it("adds Identity-owned SSF transport and receiver replay ledgers with rollback", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0149_ssf_signal_transport.sql"), "utf8"),
      readFile(resolve(drizzle, "0149_rollback.sql"), "utf8"),
    ]);
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "ssf_stream"');
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "ssf_delivery"');
    expect(forward).toContain('"source_event_id" bigint REFERENCES "domain_events"');
    expect(forward).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "ssf_delivery_stream_source_uid"');
    expect(forward).toContain('"last_mapped_event_id" bigint NOT NULL DEFAULT 0');
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "bid_ssf_replay"');
    expect(forward).toContain('CREATE TABLE IF NOT EXISTS "shop_ssf_replay"');
    expect(forward).not.toMatch(/CREATE (?:UNIQUE )?INDEX "/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_ssf_replay"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "bid_ssf_replay"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "ssf_delivery"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "ssf_stream"');
    expect(rollback.indexOf('"shop_ssf_replay"')).toBeLessThan(
      rollback.indexOf('"bid_ssf_replay"'),
    );
    expect(rollback.indexOf('"bid_ssf_replay"')).toBeLessThan(rollback.indexOf('"ssf_delivery"'));
    expect(rollback.indexOf('"ssf_delivery"')).toBeLessThan(rollback.indexOf('"ssf_stream"'));
  });
});
