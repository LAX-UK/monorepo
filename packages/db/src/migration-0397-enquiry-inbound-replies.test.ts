import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0397_enquiry_inbound_replies.sql");
const rollback = read("0397_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0397 enquiry inbound replies", () => {
  it("is registered after 0394 in the journal", () => {
    const entry = journal.entries.find((e) => e.tag === "0397_enquiry_inbound_replies");
    const previous = journal.entries.find((e) => e.tag === "0394_books_payout_bills");
    expect(entry).toBeDefined();
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`created_at" = ${entry?.when}`);
  });

  it("makes a replayed provider message the same row, on a thread and in quarantine", () => {
    expect(migration).toContain('"marketing_enquiry_message_provider_uidx"');
    expect(migration).toContain('"enquiry_inbound_quarantine_provider_uidx"');
  });

  it("limits what an inbound row can hold", () => {
    expect(migration).toContain('char_length("body") <= 20000');
    expect(migration).toContain("'token', 'in_reply_to'");
    expect(migration).toContain(
      "'unmatched', 'bad_token', 'sender_mismatch', 'spf_failed', 'auto_reply'",
    );
  });

  it("has a rollback that drops everything it adds and its ledger row", () => {
    for (const fragment of [
      'DROP TABLE IF EXISTS "enquiry_inbound_quarantine"',
      'DROP COLUMN IF EXISTS "direction"',
      'DROP COLUMN IF EXISTS "awaiting_reply_since"',
      'DELETE FROM drizzle."__drizzle_migrations"',
    ]) {
      expect(rollback).toContain(fragment);
    }
  });
});
